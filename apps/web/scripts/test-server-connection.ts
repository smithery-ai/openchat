#!/usr/bin/env tsx
/**
 * Interactive MCP Server Connection Test Script
 *
 * Search for MCP servers, connect to them, and display available tools.
 *
 * Usage:
 *   pnpm debug:test-server gmail            # Search for a server and connect
 *   pnpm debug:test-server https://...      # Use a direct MCP URL
 *   pnpm debug:test-server gmail --keep     # Keep connection after testing (default: delete)
 *   pnpm debug:test-server gmail --reuse    # Reuse existing connection if found
 *   pnpm debug:test-server gmail --error    # Error if connection already exists
 */

import "dotenv/config";
import Smithery, { AuthenticationError } from "@smithery/api";
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

// Check if input looks like a URL
function isUrl(input: string): boolean {
	return input.startsWith("http://") || input.startsWith("https://");
}

// Get default namespace
async function getDefaultNamespace(): Promise<string> {
	const response = await client.namespaces.list();
	if (response.namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return response.namespaces[0].name;
}

// Search for servers by name
async function searchServers(
	query: string,
	limit = 10,
): Promise<ServerListResponse[]> {
	console.log(`\n🔍 Searching for servers matching: ${query}`);

	const servers: ServerListResponse[] = [];
	for await (const server of client.servers.list({ q: query })) {
		servers.push(server);
		if (servers.length >= limit) {
			break;
		}
	}

	if (servers.length === 0) {
		console.log("❌ No servers found matching your query");
		return [];
	}

	console.log(`✅ Found ${servers.length} server(s)\n`);

	for (const server of servers) {
		console.log(`📦 Server: ${server.displayName || server.qualifiedName}`);
		console.log(`   Name: ${server.qualifiedName}`);
		console.log(
			`   URL: https://server.smithery.ai/${server.qualifiedName}/mcp`,
		);
		if (server.description) {
			const desc =
				server.description.length > 100
					? `${server.description.slice(0, 100)}...`
					: server.description;
			console.log(`   Description: ${desc}`);
		}
		console.log();
	}

	return servers;
}

// Connection mode: how to handle existing connections
type ConnectionMode = "create" | "reuse" | "warn" | "error";

// Find an existing connection by MCP URL
async function findExistingConnection(
	mcpUrl: string,
	namespace: string,
): Promise<{
	connectionId: string;
	mcpUrl: string;
	status?: { state?: string; message?: string; authorizationUrl?: string };
} | null> {
	try {
		const response = await client.experimental.connect.connections.list(
			namespace,
			{},
		);
		const existing = response.connections.find((c) => c.mcpUrl === mcpUrl);
		if (existing) {
			return {
				connectionId: existing.connectionId,
				mcpUrl: existing.mcpUrl,
				status: existing.status,
			};
		}
	} catch {
		// Ignore errors when listing
	}
	return null;
}

// Create or get a connection based on mode
async function createConnection(
	serverNameOrUrl: string,
	namespace: string,
	mode: ConnectionMode = "create",
): Promise<{
	connectionId: string;
	mcpUrl: string;
	isNew: boolean;
}> {
	const mcpUrl = isUrl(serverNameOrUrl)
		? serverNameOrUrl
		: `https://server.smithery.ai/${serverNameOrUrl}/mcp`;

	const displayName = isUrl(serverNameOrUrl)
		? new URL(serverNameOrUrl).hostname
		: serverNameOrUrl;

	console.log(`🔗 Checking for existing connection...`);
	console.log(`   MCP URL: ${mcpUrl}`);

	// Check if a connection with this URL already exists
	const existing = await findExistingConnection(mcpUrl, namespace);

	if (existing) {
		switch (mode) {
			case "reuse":
				console.log(`✅ Using existing connection: ${existing.connectionId}`);
				console.log(`   Status: ${existing.status?.state || "unknown"}`);
				if (existing.status?.message) {
					console.log(`   Message: ${existing.status.message}`);
				}
				if (existing.status?.authorizationUrl) {
					console.log(`   Auth URL: ${existing.status.authorizationUrl}`);
				}
				return {
					connectionId: existing.connectionId,
					mcpUrl: existing.mcpUrl,
					isNew: false,
				};

			case "error":
				throw new Error(
					`Connection already exists: ${existing.connectionId}. Use --reuse to reuse it.`,
				);

			case "warn":
				console.log(
					`⚠️  Existing connection found: ${existing.connectionId} (creating new anyway)`,
				);
				break;
			default:
				// Just create a new one without mentioning the existing one
				break;
		}
	}

	console.log(`🔗 Creating new connection...`);

	try {
		const connection = await client.experimental.connect.connections.create(
			namespace,
			{
				mcpUrl,
				name: displayName,
			},
		);

		console.log(`✅ Connection created: ${connection.connectionId}`);
		console.log(`   Status: ${connection.status?.state || "unknown"}`);
		if (connection.status?.message) {
			console.log(`   Message: ${connection.status.message}`);
		}
		if (connection.status?.authorizationUrl) {
			console.log(`   Auth URL: ${connection.status.authorizationUrl}`);
		}

		return {
			connectionId: connection.connectionId,
			mcpUrl: connection.mcpUrl,
			isNew: true,
		};
	} catch (error) {
		console.error("❌ Failed to create connection");
		throw error;
	}
}

// Get tools from a connection
async function getTools(
	connectionId: string,
	namespace: string,
): Promise<Array<{ name: string; description?: string }>> {
	console.log(`\n🛠️  Fetching available tools...`);

	try {
		const response = await client.experimental.connect.mcp.call(
			connectionId,
			{ namespace },
			{
				body: {
					jsonrpc: "2.0",
					method: "tools/list",
				},
			},
		);

		const result = response.result as
			| { tools?: Array<{ name: string; description?: string }> }
			| undefined;
		const tools = result?.tools || [];

		if (tools.length === 0) {
			console.log("⚠️  No tools available from this server");
			return [];
		}

		console.log(`✅ Available Tools (${tools.length}):\n`);

		for (let i = 0; i < tools.length; i++) {
			const tool = tools[i];
			console.log(`   ${i + 1}. ${tool.name}`);
			if (tool.description) {
				const desc =
					tool.description.length > 80
						? `${tool.description.slice(0, 80)}...`
						: tool.description;
				console.log(`      ${desc}`);
			}
			console.log();
		}

		return tools;
	} catch (error) {
		if (error instanceof AuthenticationError) {
			console.error("❌ Authentication required");
			console.log(
				"\n   This server requires authentication. Check the connection",
			);
			console.log("   in the Smithery dashboard for the authorization URL.");
		} else {
			console.error("❌ Failed to get tools");
			console.error(
				`   Error: ${error instanceof Error ? error.message : error}`,
			);
		}
		return [];
	}
}

// Delete a connection
async function deleteConnection(
	connectionId: string,
	namespace: string,
): Promise<void> {
	console.log(`\n🗑️  Deleting connection: ${connectionId}`);
	try {
		await client.experimental.connect.connections.delete(connectionId, {
			namespace,
		});
		console.log("✅ Connection deleted");
	} catch (error) {
		console.error(
			`⚠️  Failed to delete connection: ${error instanceof Error ? error.message : error}`,
		);
	}
}

async function main() {
	console.log("🚀 MCP Server Connection Test");
	console.log("==============================");

	// Parse command line arguments
	const args = process.argv.slice(2);
	const keepFlag = args.includes("--keep");
	const reuseFlag = args.includes("--reuse");
	const errorFlag = args.includes("--error");
	const serverInput = args.find((arg) => !arg.startsWith("--"));

	// Determine connection mode (default: warn)
	let connectionMode: ConnectionMode = "warn";
	if (reuseFlag) connectionMode = "reuse";
	else if (errorFlag) connectionMode = "error";

	if (!serverInput) {
		console.log("\nUsage:");
		console.log("  pnpm debug:test-server <server-name>    Search and connect");
		console.log(
			"  pnpm debug:test-server <mcp-url>        Connect to direct URL",
		);
		console.log("\nConnection Mode Options:");
		console.log("  --reuse     Reuse existing connection if found");
		console.log("  --error     Error if connection already exists");
		console.log("  (default)   Warn if exists, then create new");
		console.log("\nCleanup Options:");
		console.log("  --keep      Keep connection after testing");
		console.log("  (default)   Delete connection after testing");
		console.log("\nExamples:");
		console.log("  pnpm debug:test-server exa");
		console.log("  pnpm debug:test-server gmail --reuse");
		console.log("  pnpm debug:test-server https://mcp.notion.com/mcp --keep");
		process.exit(1);
	}

	// Get namespace
	let namespace: string;
	try {
		namespace = await getDefaultNamespace();
		console.log(`\n📁 Using namespace: ${namespace}`);
	} catch (error) {
		console.error(
			`❌ Failed to get namespace: ${error instanceof Error ? error.message : error}`,
		);
		process.exit(1);
	}

	let serverName = serverInput;

	// If it's not a URL, search for the server
	if (!isUrl(serverInput)) {
		const servers = await searchServers(serverInput);

		if (servers.length === 0) {
			process.exit(1);
		}

		// Use the first (best match) server
		serverName = servers[0].qualifiedName;
		console.log(`📌 Selected: ${servers[0].displayName || serverName}\n`);
	}

	// Create connection
	let connection: { connectionId: string; mcpUrl: string; isNew: boolean };
	try {
		connection = await createConnection(serverName, namespace, connectionMode);
	} catch (error) {
		console.error(
			`\n❌ Connection failed: ${error instanceof Error ? error.message : error}`,
		);
		process.exit(1);
	}

	// Get tools
	await getTools(connection.connectionId, namespace);

	// Clean up by default (unless --keep is specified)
	// Only delete if we created the connection (not if we reused an existing one)
	if (!keepFlag && connection.isNew) {
		await deleteConnection(connection.connectionId, namespace);
	} else if (keepFlag) {
		console.log(`\n📌 Connection kept: ${connection.connectionId}`);
	}

	console.log("✨ Connection test complete!");
}

main().catch((error) => {
	console.error("\n❌ Unexpected error:", error);
	process.exit(1);
});
