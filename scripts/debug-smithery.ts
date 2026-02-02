#!/usr/bin/env tsx
/**
 * Debug script for testing Smithery API connectivity and configuration
 *
 * Usage:
 *   pnpm tsx scripts/debug-smithery.ts
 *   pnpm tsx scripts/debug-smithery.ts --test-connection gmail
 */

import "dotenv/config";
import Smithery from "@smithery/api";

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

async function testBasicConnectivity() {
	console.log("\n🔍 Testing basic API connectivity...");
	console.log(`   Base URL: ${BASE_URL || "default"}`);

	try {
		const response = await client.namespaces.list();
		console.log(`✅ API connection successful`);
		console.log(`   Namespaces found: ${response.namespaces.length}`);

		if (response.namespaces.length === 0) {
			console.log("⚠️  No namespaces found - you may need to create one");
			return null;
		}

		const namespace = response.namespaces[0];
		console.log(`   Default namespace: ${namespace.name}`);
		return namespace.name;
	} catch (error) {
		console.error("❌ Failed to connect to Smithery API");
		console.error(
			`   Error: ${error instanceof Error ? error.message : error}`,
		);
		return null;
	}
}

async function testTokenCreation(namespace: string) {
	console.log("\n🔍 Testing token creation...");

	try {
		const token = await client.tokens.create({
			policy: [
				{
					namespaces: [namespace],
					operations: ["read", "write"],
					resources: ["connections"],
					ttl: 60, // 1 minute for testing
				},
				{
					namespaces: [namespace],
					operations: ["read"],
					resources: ["servers", "skills"],
					ttl: 60, // 1 minute for testing
				},
			],
		});
		console.log("✅ Token created successfully");
		console.log(`   Token: ${token.token.substring(0, 20)}...`);
		console.log(`   Expires: ${token.expiresAt}`);
		return token.token;
	} catch (error) {
		console.error("❌ Failed to create token");
		console.error(
			`   Error: ${error instanceof Error ? error.message : error}`,
		);
		return null;
	}
}

async function listConnections(namespace: string) {
	console.log("\n🔍 Listing existing connections...");

	try {
		const response = await client.experimental.connect.connections.list(
			namespace,
			{},
		);
		console.log(`✅ Found ${response.connections.length} connections`);

		for (const conn of response.connections) {
			console.log(`\n   Connection: ${conn.name || conn.connectionId}`);
			console.log(`   - ID: ${conn.connectionId}`);
			console.log(`   - URL: ${conn.mcpUrl}`);
			console.log(`   - Status: ${conn.status?.state || "unknown"}`);
			if (conn.status?.message) {
				console.log(`   - Message: ${conn.status.message}`);
			}
		}

		return response.connections;
	} catch (error) {
		console.error("❌ Failed to list connections");
		console.error(
			`   Error: ${error instanceof Error ? error.message : error}`,
		);
		return [];
	}
}

async function testConnection(connectionId: string, namespace: string) {
	console.log(`\n🔍 Testing connection: ${connectionId}...`);

	try {
		// First get the connection details
		const connection = await client.experimental.connect.connections.get(
			connectionId,
			{ namespace },
		);

		console.log(`   Status: ${connection.status?.state || "unknown"}`);
		console.log(`   URL: ${connection.mcpUrl}`);

		if (connection.status?.message) {
			console.log(`   Message: ${connection.status.message}`);
		}

		// Try to call tools/list
		console.log("\n   Attempting to call tools/list...");
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
			| { tools?: Array<{ name: string }> }
			| undefined;
		console.log(`✅ Connection test successful`);
		console.log(`   Tools available: ${result?.tools?.length || 0}`);

		if (result?.tools && result.tools.length > 0) {
			console.log(
				`   Tool names: ${result.tools.map((t) => t.name).join(", ")}`,
			);
		}
	} catch (error: any) {
		console.error("❌ Connection test failed");
		console.error(`   Error: ${error?.message || error}`);

		if (error?.status) {
			console.error(`   HTTP Status: ${error.status}`);
		}

		if (error?.error) {
			console.error(`   Details: ${JSON.stringify(error.error, null, 2)}`);
		}
	}
}

async function createTestConnection(serverName: string, namespace: string) {
	console.log(`\n🔍 Creating test connection for: ${serverName}...`);

	const mcpUrl = `https://server.smithery.ai/${serverName}/mcp`;
	console.log(`   MCP URL: ${mcpUrl}`);

	try {
		const connection = await client.experimental.connect.connections.create(
			namespace,
			{
				mcpUrl,
				name: serverName,
			},
		);

		console.log(`✅ Connection created`);
		console.log(`   Connection ID: ${connection.connectionId}`);
		console.log(`   Status: ${connection.status?.state || "unknown"}`);

		if (connection.status?.message) {
			console.log(`   Message: ${connection.status.message}`);
		}

		if (connection.status?.authorizationUrl) {
			console.log(`   Auth URL: ${connection.status.authorizationUrl}`);
		}

		return connection;
	} catch (error) {
		console.error("❌ Failed to create connection");
		console.error(
			`   Error: ${error instanceof Error ? error.message : error}`,
		);
		return null;
	}
}

async function main() {
	console.log("🚀 Smithery API Debug Tool");
	console.log("============================");

	const namespace = await testBasicConnectivity();
	if (!namespace) {
		process.exit(1);
	}

	await testTokenCreation(namespace);
	const connections = await listConnections(namespace);

	// Check for command line arguments
	const args = process.argv.slice(2);
	const testConnectionFlag = args.indexOf("--test-connection");

	if (testConnectionFlag !== -1 && args[testConnectionFlag + 1]) {
		const serverName = args[testConnectionFlag + 1];

		// Check if connection already exists
		const existing = connections.find(
			(c) => c.name === serverName || c.connectionId === serverName,
		);

		if (existing) {
			console.log(`\n   Found existing connection for ${serverName}`);
			await testConnection(existing.connectionId, namespace);
		} else {
			console.log(`\n   No existing connection found, creating new one...`);
			const newConnection = await createTestConnection(serverName, namespace);
			if (newConnection) {
				await testConnection(newConnection.connectionId, namespace);
			}
		}
	}

	console.log("\n✨ Debug complete!");
}

main().catch(console.error);
