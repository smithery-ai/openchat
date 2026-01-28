import { createMCPClient } from "@ai-sdk/mcp";
import { Smithery } from "@smithery/api";
import { createConnection } from "@smithery/api/lib/mcp-transport.mjs";
import type { Connection } from "@smithery/api/resources/beta/connect/connections";

export async function POST(request: Request) {
	const { connections, apiKey, namespace } = (await request.json()) as {
		connections: Connection[];
		apiKey: string;
		namespace: string;
	};

    const allTools = await Promise.all(connections.map(async (connection) => {
        const { transport } = await createConnection({
            client: new Smithery({ apiKey }),
            connectionId: connection.connectionId,
            namespace,
        });
        const mcpClient = await createMCPClient({ transport });
        return mcpClient.tools();
    }));

    const flattenedTools = allTools.flat();

    console.log(JSON.stringify(flattenedTools, null, 2));

    return Response.json({ flattenedTools });
}
