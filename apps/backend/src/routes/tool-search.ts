import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type {
	FailedToolSearch,
	SuccessfulToolSearch,
} from "@openchat/registry/smithery/types";
import { Smithery } from "@smithery/api";
import { createConnection } from "@smithery/api/lib/mcp-transport.mjs";
import type { Connection } from "@smithery/api/resources/experimental/connect/connections";
import { Index } from "flexsearch";
import { Hono } from "hono";
import { estimateTokenCount } from "tokenx";

type SuccessfulToolSearch = {
	connectionStatus: "connected";
	connectionLatency: number;
	toolsTokenCount: number;
};
type FailedToolSearch = {
	connectionStatus: "failed";
	connectionLatency: number;
	error: string;
};

export const toolSearchRoute = new Hono();

toolSearchRoute.post("/tool-search", async (c) => {
	const startTime = performance.now();

	const { connections, apiKey, namespace, action } = await c.req.json<{
		connections: Connection[];
		apiKey: string;
		namespace: string;
		action: string;
	}>();

	const index = new Index({
		tokenize: "forward",
	});
	const connectionStats: Record<
		string,
		SuccessfulToolSearch | FailedToolSearch
	> = {};
	const toolMap: Record<string, Tool> = {};
	let toolsTokenCount = 0;

	const allTools = await Promise.all(
		connections.map(async (connection) => {
			const startTime = performance.now();
			const tools: Tool[] = [];
			try {
				const { transport } = await createConnection({
					client: new Smithery({ apiKey }),
					connectionId: connection.connectionId,
					namespace,
				});
				const mcpClient = new Client({
					name: "smithery-mcp-client",
					version: "1.0.0",
				});
				await mcpClient.connect(transport);

				const { tools: mcpTools } = await mcpClient.listTools();
				const serverToolsTokenCount = estimateTokenCount(
					JSON.stringify(mcpTools, null, 2),
				);
				mcpTools.forEach((tool) => {
					const indexKey = `${connection.connectionId}::${tool.name}`;
					toolMap[indexKey] = tool;
					index.add(indexKey, JSON.stringify(tool));
					tools.push(tool);
				});
				const connectionLatency = performance.now() - startTime;
				connectionStats[connection.connectionId] = {
					connectionStatus: "connected",
					connectionLatency,
					toolsTokenCount: serverToolsTokenCount,
				};
				toolsTokenCount += serverToolsTokenCount;
			} catch (error) {
				connectionStats[connection.connectionId] = {
					connectionStatus: "failed",
					connectionLatency: performance.now() - startTime,
					error: error instanceof Error ? error.message : "Unknown error",
				};
				console.error(
					"Error connecting to connection:",
					connection.connectionId,
					error,
				);
			}
		}),
	);

	const searchResults = index.search(action);
	const output = searchResults
		.map((result) => {
			const [connectionId, _toolName] = result.toString().split("::");
			const tool = toolMap[result];
			return {
				connectionId,
				tool,
			};
		})
		.filter((result) => result.tool !== undefined);

	console.log(JSON.stringify(searchResults, null, 2));

	const endTime = performance.now();
	const latency = endTime - startTime;

	const totalTools = allTools.flat().length;

	console.log("Final toolsTokenCount:", toolsTokenCount);

	const responseBody = {
		action,
		searchResults: output,
		latency,
		totalTools,
		tokensProcessed: toolsTokenCount,
		connectionStats,
	};

	console.log("Response body:", JSON.stringify(responseBody, null, 2));

	return c.json(responseBody);
});
