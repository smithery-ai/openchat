import { Smithery } from "@smithery/api";
import { createConnection } from "@smithery/api/lib/mcp-transport.mjs";
import type { Connection } from "@smithery/api/resources/beta/connect/connections";
import { Index } from "flexsearch";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { estimateTokenCount } from "tokenx";

export async function POST(request: Request) {
	const startTime = performance.now();
	
	const { connections, apiKey, namespace, action } = (await request.json()) as {
		connections: Connection[];
		apiKey: string;
		namespace: string;
        action: string;
	};

	const index = new Index({
		// use forward when you want to match partials
		// e.g. match "flexsearch" when query "flex"
		tokenize: "forward",
	});

	const allTools = await Promise.all(
		connections.map(async (connection) => {
			const { transport } = await createConnection({
				client: new Smithery({ apiKey }),
				connectionId: connection.connectionId,
				namespace,
			});
			// Connect using the MCP SDK Client
			const mcpClient = new Client({
				name: "smithery-mcp-client",
				version: "1.0.0",
			});
			await mcpClient.connect(transport);

			// Use the MCP SDK's ergonomic API
			const { tools } = await mcpClient.listTools();
			console.log(JSON.stringify(tools, null, 2));
            tools.forEach(tool => {
                index.add(`${connection.connectionId}::${tool.name}`, JSON.stringify(tool));
            });
			return tools;
		}),
	);

    const searchResults = index.search(action);

	console.log(JSON.stringify(searchResults, null, 2));

	const endTime = performance.now();
	const latency = endTime - startTime;
	
	// Calculate total number of tools
	const totalTools = allTools.flat().length;
	
	// Calculate tokens processed for all tools
	const toolsTokenCount = allTools
		.flat()
		.reduce((total, tool) => {
			return total + (estimateTokenCount(JSON.stringify(tool)) || 0);
		}, 0);

	return Response.json({ 
		searchResults,
		latency,
		totalTools,
		tokensProcessed: toolsTokenCount,
	});
}
