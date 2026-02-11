#!/usr/bin/env tsx
/**
 * Sanity check for the MCP client "unknown message ID" error.
 *
 * Reproduces the flow where @smithery/api's createConnection + @ai-sdk/mcp's
 * createMCPClient throws:
 *   MCPClientError: Protocol error: Received a response for an unknown message ID
 *
 * Usage:
 *   pnpm debug:check-mcp linear           # Search for server, use existing connection
 *   pnpm debug:check-mcp --id <conn-id>   # Use a specific connection ID
 *   pnpm debug:check-mcp --id <conn-id> --namespace <ns>
 */

import "dotenv/config";
import Smithery from "@smithery/api";
import { createConnection } from "@smithery/api/mcp";
import { createMCPClient } from "@ai-sdk/mcp";
import type { ServerListResponse } from "@smithery/api/resources/index.mjs";

const API_KEY = process.env.SMITHERY_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_SMITHERY_API_URL;

if (!API_KEY) {
	console.error("❌ SMITHERY_API_KEY not set in environment");
	process.exit(1);
}

const client = new Smithery({
	apiKey: API_KEY,
	baseURL: BASE_URL,
});

// --- Helpers (reused from existing scripts) ---

async function getDefaultNamespace(): Promise<string> {
	const response = await client.namespaces.list();
	if (response.namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return response.namespaces[0].name;
}

async function searchServers(
	query: string,
	limit = 5,
): Promise<ServerListResponse[]> {
	const servers: ServerListResponse[] = [];
	for await (const server of client.servers.list({ q: query })) {
		servers.push(server);
		if (servers.length >= limit) break;
	}
	return servers;
}

async function findConnectionByServer(
	serverName: string,
	namespace: string,
): Promise<{ connectionId: string; mcpUrl: string; state?: string } | null> {
	const mcpUrl = `https://server.smithery.ai/${serverName}/mcp`;
	const response = await client.experimental.connect.connections.list(
		namespace,
		{},
	);
	const match = response.connections.find((c) => c.mcpUrl === mcpUrl);
	if (match) {
		return {
			connectionId: match.connectionId,
			mcpUrl: match.mcpUrl,
			state: match.status?.state,
		};
	}
	return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`${label} timed out after ${ms}ms`)),
			ms,
		);
		promise.then(
			(val) => {
				clearTimeout(timer);
				resolve(val);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			},
		);
	});
}

// --- Test functions ---

async function testDirectMcpCall(
	connectionId: string,
	namespace: string,
): Promise<boolean> {
	console.log("\n📋 Test 1: Direct MCP call via Smithery REST API");
	console.log("   (Bypasses @ai-sdk/mcp — validates the server itself works)");

	try {
		const response = await client.experimental.connect.mcp.call(
			connectionId,
			{ namespace },
			{ body: { jsonrpc: "2.0", method: "tools/list" } },
		);

		const result = response.result as
			| { tools?: Array<{ name: string }> }
			| undefined;
		const toolCount = result?.tools?.length ?? 0;
		console.log(`   ✅ PASS — server responded, ${toolCount} tool(s) available`);
		return true;
	} catch (error) {
		console.log(
			`   ❌ FAIL — ${error instanceof Error ? error.message : error}`,
		);
		return false;
	}
}

async function testCreateMCPClient(
	connectionId: string,
	namespace: string,
	handshake: boolean,
): Promise<boolean> {
	const label = handshake ? "handshake: true" : "handshake: false (default)";
	const testNum = handshake ? 3 : 2;
	console.log(`\n📋 Test ${testNum}: createConnection(${label}) + createMCPClient()`);
	console.log(
		handshake
			? "   (Transport does its own init handshake before @ai-sdk/mcp's)"
			: "   (Transport skips init via sessionId: 'smithery-stateless')",
	);

	let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;

	try {
		const { transport } = await createConnection({
			client,
			connectionId,
			namespace,
			handshake,
		});

		mcpClient = await withTimeout(
			createMCPClient({ transport }),
			15_000,
			"createMCPClient",
		);

		const tools = await withTimeout(mcpClient.tools(), 15_000, "tools()");
		const toolCount = Object.keys(tools).length;
		console.log(`   ✅ PASS — client initialized, ${toolCount} tool(s) loaded`);
		return true;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		const isUnknownId = msg.includes("unknown message ID");
		if (isUnknownId) {
			console.log("   ❌ FAIL — unknown message ID error (the bug)");
			console.log(`   ${msg.slice(0, 200)}`);
		} else {
			console.log(`   ❌ FAIL — ${msg.slice(0, 200)}`);
		}
		return false;
	} finally {
		try {
			await mcpClient?.close();
		} catch {
			// ignore close errors
		}
	}
}

// --- Main ---

async function main() {
	console.log("🚀 MCP Client Sanity Check");
	console.log("===========================");
	console.log("Reproduces the 'unknown message ID' error from:");
	console.log("  createConnection() + createMCPClient()\n");

	// Parse args
	const args = process.argv.slice(2);
	const idFlagIdx = args.indexOf("--id");
	const nsFlagIdx = args.indexOf("--namespace");
	const connectionIdArg =
		idFlagIdx !== -1 ? args[idFlagIdx + 1] : undefined;
	const namespaceArg =
		nsFlagIdx !== -1 ? args[nsFlagIdx + 1] : undefined;
	const serverQuery = args.find(
		(a) => !a.startsWith("--") && a !== connectionIdArg && a !== namespaceArg,
	);

	if (!connectionIdArg && !serverQuery) {
		console.log("Usage:");
		console.log("  pnpm debug:check-mcp linear");
		console.log("  pnpm debug:check-mcp --id <connection-id>");
		console.log("  pnpm debug:check-mcp --id <connection-id> --namespace <ns>");
		process.exit(1);
	}

	// Resolve namespace
	let namespace: string;
	try {
		namespace = namespaceArg || (await getDefaultNamespace());
		console.log(`📁 Namespace: ${namespace}`);
	} catch (error) {
		console.error(
			`❌ Failed to resolve namespace: ${error instanceof Error ? error.message : error}`,
		);
		process.exit(1);
	}

	// Resolve connection
	let connectionId: string;
	if (connectionIdArg) {
		connectionId = connectionIdArg;
		console.log(`🔗 Connection ID: ${connectionId}`);
	} else {
		console.log(`🔍 Searching for server: ${serverQuery}`);
		const servers = await searchServers(serverQuery!);
		if (servers.length === 0) {
			console.error("❌ No servers found");
			process.exit(1);
		}
		const serverName = servers[0].qualifiedName;
		console.log(`📌 Found: ${servers[0].displayName || serverName}`);

		const existing = await findConnectionByServer(serverName, namespace);
		if (!existing) {
			console.error(
				`❌ No existing connection for ${serverName} in namespace ${namespace}`,
			);
			console.error("   Create one first: pnpm debug:test-server " + serverQuery);
			process.exit(1);
		}
		connectionId = existing.connectionId;
		console.log(`🔗 Connection ID: ${connectionId} (state: ${existing.state})`);

		if (existing.state !== "connected") {
			console.error(`❌ Connection is not in 'connected' state (${existing.state})`);
			console.error("   The server may require authorization first.");
			process.exit(1);
		}
	}

	// Verify connection status
	try {
		const conn = await client.experimental.connect.connections.get(
			connectionId,
			{ namespace },
		);
		console.log(`   Server: ${conn.serverInfo?.title ?? conn.serverInfo?.name ?? conn.name}`);
		console.log(`   State:  ${conn.status?.state ?? "unknown"}`);
		console.log(`   URL:    ${conn.mcpUrl}`);
	} catch (error) {
		console.error(
			`❌ Could not fetch connection: ${error instanceof Error ? error.message : error}`,
		);
		process.exit(1);
	}

	// Run tests
	const results: { name: string; passed: boolean }[] = [];

	const t1 = await testDirectMcpCall(connectionId, namespace);
	results.push({ name: "Direct MCP call (REST API)", passed: t1 });

	const t2 = await testCreateMCPClient(connectionId, namespace, false);
	results.push({ name: "createMCPClient (handshake: false)", passed: t2 });

	const t3 = await testCreateMCPClient(connectionId, namespace, true);
	results.push({ name: "createMCPClient (handshake: true)", passed: t3 });

	// Summary
	console.log("\n===========================");
	console.log("📊 Results:\n");
	for (const r of results) {
		console.log(`   ${r.passed ? "✅" : "❌"} ${r.name}`);
	}

	const allPassed = results.every((r) => r.passed);
	console.log(
		allPassed
			? "\n✨ All checks passed!"
			: "\n⚠️  Some checks failed — see details above.",
	);
	process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
	console.error("\n❌ Unexpected error:", error);
	process.exit(1);
});
