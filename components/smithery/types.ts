export type ConnectionConfig = {
	serverUrl: string;
	configId: string;
};

// MCP Tool type (simplified from @modelcontextprotocol/sdk)
export type MCPTool = {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
};

export type ToolCallTemplate = {
	toolName: string;
	argsTemplate: Record<string, unknown>;
	server: ConnectionConfig;
};

export class MCPAuthenticationRequiredError extends Error {
	authorizationUrl: string;
	constructor(message: string, authorizationUrl: string) {
		super(message);
		this.name = "MCPAuthenticationRequiredError";
		this.authorizationUrl = authorizationUrl;
	}
}
