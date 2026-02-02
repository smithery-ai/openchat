"use server";
import Smithery, { AuthenticationError, NotFoundError } from "@smithery/api";
import type { ServerListResponse } from "@smithery/api/resources/index.mjs";
import { generateText, jsonSchema, stepCountIs, tool } from "ai";
import type { ConnectionConfig, MCPTool } from "./types";

// Helper to get Smithery client with provided or env API key
function getSmitheryClient(apiKey?: string | null) {
	const keyToUse = apiKey || process.env.SMITHERY_API_KEY;
	if (!keyToUse) {
		throw new Error("Smithery API key not configured");
	}
	return new Smithery({
		apiKey: keyToUse,
		baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	});
}

// Helper to get default namespace (always uses root API key since scoped tokens lack namespaces:read)
async function getDefaultNamespace() {
	const client = getSmitheryClient();
	const namespaces = await client.namespaces.list();
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return namespaces.namespaces[0].name;
}

// Sanitize connection ID for use with Smithery
function sanitizeConnectionId(str: string): string {
	return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Extract authorization URL from Smithery auth error
function extractAuthUrl(error: AuthenticationError): string {
	if (
		error.error &&
		typeof error.error === "object" &&
		"error" in error.error &&
		error.error.error &&
		typeof error.error.error === "object" &&
		"data" in error.error.error &&
		error.error.error.data &&
		typeof error.error.error.data === "object" &&
		"authorizationUrl" in error.error.error.data &&
		typeof error.error.error.data.authorizationUrl === "string"
	) {
		return error.error.error.data.authorizationUrl;
	}
	return "";
}

export const searchServers = async (
	query: string,
	limit = 5,
	apiKey?: string | null,
) => {
	console.log("searchServers", query, limit);
	const client = getSmitheryClient(apiKey);
	const servers: ServerListResponse[] = [];
	for await (const serverListResponse of client.servers.list({
		q: query,
	})) {
		servers.push(serverListResponse);
		if (servers.length >= limit) {
			break;
		}
	}
	return servers;
};

export const enableServer = async (
	serverName: string,
	apiKey?: string | null,
): Promise<
	| { status: "connected"; connectionConfig: ConnectionConfig }
	| { status: "auth_required"; authorizationUrl: string }
> => {
	const client = getSmitheryClient(apiKey);
	const namespace = await getDefaultNamespace();
	const connectionId = sanitizeConnectionId(serverName);
	const serverUrl =
		serverName.startsWith("http://") || serverName.startsWith("https://")
			? serverName
			: `https://server.smithery.ai/${serverName}/mcp`;

	// Get or create connection
	let mcpUrl = serverUrl;
	try {
		const connection = await client.experimental.connect.connections.get(
			connectionId,
			{
				namespace,
			},
		);
		mcpUrl = connection.mcpUrl;
	} catch (error) {
		if (error instanceof NotFoundError) {
			const connection = await client.experimental.connect.connections.set(
				connectionId,
				{
					namespace,
					mcpUrl: serverUrl,
					name: serverName,
				},
			);
			mcpUrl = connection.mcpUrl;
		} else {
			throw error;
		}
	}

	// Verify auth by calling tools/list
	try {
		await client.experimental.connect.mcp.call(
			connectionId,
			{
				namespace,
			},
			{
				body: {
					jsonrpc: "2.0",
					method: "tools/list",
				},
			},
		);
		return {
			status: "connected",
			connectionConfig: {
				serverUrl: mcpUrl,
				configId: connectionId,
			},
		};
	} catch (error) {
		if (error instanceof AuthenticationError && error.status === 401) {
			const authorizationUrl = extractAuthUrl(error);
			if (authorizationUrl) {
				return {
					status: "auth_required",
					authorizationUrl,
				};
			}
		}
		console.error("error using server", error);
		throw error;
	}
};

export const listNamespaces = async () => {
	// Always use root API key since scoped tokens lack namespaces:read
	const client = getSmitheryClient();
	const response = await client.namespaces.list();
	return response.namespaces;
};

export const getConnections = async (
	namespace: string,
	apiKey?: string | null,
) => {
	const client = getSmitheryClient(apiKey);
	const connections = await client.experimental.connect.connections.list(
		namespace,
		{},
	);
	return connections.connections;
};

export const deleteConnection = async (
	connectionId: string,
	namespace: string,
	apiKey?: string | null,
) => {
	const client = getSmitheryClient(apiKey);
	await client.experimental.connect.connections.delete(connectionId, {
		namespace,
	});
	return { success: true };
};

export const checkConnection = async (
	server: string,
	apiKey?: string | null,
) => {
	const client = getSmitheryClient(apiKey);
	const namespace = await getDefaultNamespace();
	const connectionId = sanitizeConnectionId(server);
	const serverUrl =
		server.startsWith("http://") || server.startsWith("https://")
			? server
			: `https://server.smithery.ai/${server}/mcp`;

	// Get or create connection
	try {
		await client.experimental.connect.connections.get(connectionId, {
			namespace,
		});
	} catch (error) {
		if (error instanceof NotFoundError) {
			await client.experimental.connect.connections.set(connectionId, {
				namespace,
				mcpUrl: serverUrl,
				name: server,
			});
		} else {
			return { status: "error" as const };
		}
	}

	// Check auth by calling tools/list
	try {
		await client.experimental.connect.mcp.call(
			connectionId,
			{
				namespace,
			},
			{
				body: {
					jsonrpc: "2.0",
					method: "tools/list",
				},
			},
		);
		return { status: "success" as const };
	} catch (error) {
		if (error instanceof AuthenticationError && error.status === 401) {
			return { status: "needs_auth" as const };
		}
		return { status: "error" as const };
	}
};

export const testConnection = async (
	connectionId: string,
	namespace: string,
	apiKey?: string | null,
) => {
	try {
		const client = getSmitheryClient(apiKey);
		const response = await client.experimental.connect.mcp.call(
			connectionId,
			{
				namespace: namespace,
			},
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
		const toolCount = result?.tools?.length ?? 0;

		return {
			success: true,
			toolCount,
			tools: result?.tools || [],
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

// Alias for backward compatibility (planAction -> searchTool)
export const planAction = async (
	prompt: string,
	serverConfigs: ConnectionConfig[],
	apiKey?: string | null,
) => {
	const client = getSmitheryClient(apiKey);
	const namespace = await getDefaultNamespace();
	// Get tools from all connections
	const toolsWithConfigs = await Promise.all(
		serverConfigs.map(async (config) => {
			const response = await client.experimental.connect.mcp.call(
				config.configId,
				{
					namespace,
				},
				{
					body: {
						jsonrpc: "2.0",
						method: "tools/list",
					},
				},
			);
			const result = response.result as { tools?: MCPTool[] } | undefined;
			const tools = result?.tools ?? [];
			return tools.map((t) => ({ tool: t, config }));
		}),
	).then((arrays) => arrays.flat());

	if (toolsWithConfigs.length === 0) {
		throw new Error("No tools available from connected servers");
	}

	// Build tool -> config lookup
	const toolConfigMap = new Map<string, ConnectionConfig>();
	for (const { tool: mcpTool, config } of toolsWithConfigs) {
		toolConfigMap.set(mcpTool.name, config);
	}

	// Build AI tools from MCP schemas
	const aiTools = Object.fromEntries(
		toolsWithConfigs.map(({ tool: mcpTool }) => [
			mcpTool.name,
			tool({
				description: mcpTool.description ?? "",
				inputSchema: jsonSchema(mcpTool.inputSchema),
			}),
		]),
	);

	// Use AI to select the right tool
	const result = await generateText({
		model: "google/gemini-2.0-flash",
		tools: aiTools,
		prompt,
		toolChoice: "required",
		stopWhen: stepCountIs(1),
	});

	const toolCall = result.toolCalls[0];
	if (!toolCall) {
		throw new Error("No tool call was generated by the model");
	}

	const selectedConfig = toolConfigMap.get(toolCall.toolName);
	if (!selectedConfig) {
		throw new Error(`No server found for tool: ${toolCall.toolName}`);
	}

	return {
		output: {
			toolName: toolCall.toolName,
			argsTemplate: toolCall.input as Record<string, unknown>,
			server: selectedConfig,
		},
	};
};

export const runTool = async (
	configId: string,
	namespace: string,
	toolName: string,
	args: Record<string, unknown>,
	apiKey?: string | null,
) => {
	const client = getSmitheryClient(apiKey);
	const response = await client.experimental.connect.mcp.call(
		configId,
		{
			namespace: namespace,
		},
		{
			body: {
				jsonrpc: "2.0",
				method: "tools/call",
				params: { name: toolName, arguments: args },
			},
		},
	);
	return response.result;
};

export const validateSmitheryApiKey = async (
	apiKey: string | null = null,
): Promise<{
	isValid: boolean;
	error?: string;
}> => {
	try {
		// Use provided API key or fall back to env var
		const keyToValidate = apiKey || process.env.SMITHERY_API_KEY;

		if (!keyToValidate) {
			return { isValid: false, error: "API key not configured" };
		}

		// Validate by making lightweight API call
		const client = new Smithery({
			apiKey: keyToValidate,
			baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
		});
		await client.namespaces.list();
		return { isValid: true };
	} catch (error) {
		return {
			isValid: false,
			error: error instanceof Error ? error.message : "Invalid API key",
		};
	}
};
