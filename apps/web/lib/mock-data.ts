import type { Tool } from "ai";

// JSON Schema type for our mock data
interface JSONSchema {
	type?: string;
	properties?: Record<string, JSONSchemaProperty>;
	required?: string[];
	additionalProperties?: boolean;
}

interface JSONSchemaProperty {
	type?: string | string[];
	description?: string;
	enum?: string[];
	minimum?: number;
	maximum?: number;
	default?: unknown;
	items?: JSONSchemaProperty;
}

// Helper to create mock tools with proper typing
// The component handles both raw JSON schema and { jsonSchema: ... } format
function createMockTool(
	description: string,
	schema: JSONSchema,
	type = "function",
): Tool {
	return {
		type,
		description,
		inputSchema: { jsonSchema: schema },
	} as Tool;
}

// Mock tool for demonstrations
export const MOCK_TOOL_SEARCH = createMockTool(
	"Search for content across various sources",
	{
		type: "object",
		properties: {
			query: { type: "string", description: "Search query" },
			limit: {
				type: "number",
				description: "Max results to return",
				default: 10,
			},
			includeMetadata: {
				type: "boolean",
				description: "Include metadata in results",
				default: false,
			},
		},
		required: ["query"],
	},
);

export const MOCK_TOOL_FETCH_DATA = createMockTool(
	"Fetch data from a remote API endpoint",
	{
		type: "object",
		properties: {
			url: { type: "string", description: "The URL to fetch data from" },
			method: {
				type: "string",
				enum: ["GET", "POST", "PUT", "DELETE"],
				description: "HTTP method",
				default: "GET",
			},
			headers: { type: "object", description: "Request headers" },
		},
		required: ["url"],
	},
);

export const MOCK_TOOL_PROCESS_TEXT = createMockTool(
	"Process and transform text content",
	{
		type: "object",
		properties: {
			text: { type: "string", description: "The text to process" },
			operation: {
				type: "string",
				enum: ["uppercase", "lowercase", "reverse", "trim"],
				description: "Operation to perform",
			},
			preserveWhitespace: {
				type: "boolean",
				description: "Preserve whitespace",
				default: true,
			},
		},
		required: ["text", "operation"],
	},
);

export const MOCK_TOOL_SEND_EMAIL = createMockTool(
	"Send an email to a recipient",
	{
		type: "object",
		properties: {
			to: { type: "string", description: "Recipient email address" },
			subject: { type: "string", description: "Email subject line" },
			body: {
				type: "string",
				description: "Email body content (supports markdown)",
			},
			cc: {
				type: "array",
				items: { type: "string" },
				description: "CC recipients",
			},
		},
		required: ["to", "subject", "body"],
	},
);

export const MOCK_TOOLS: Record<string, Tool> = {
	search: MOCK_TOOL_SEARCH,
	"fetch-data": MOCK_TOOL_FETCH_DATA,
	"process-text": MOCK_TOOL_PROCESS_TEXT,
	"send-email": MOCK_TOOL_SEND_EMAIL,
};

// Mock JSON schema for SchemaForm demo
export const MOCK_SCHEMA: JSONSchema = {
	type: "object",
	properties: {
		name: { type: "string", description: "Your full name" },
		email: { type: "string", description: "Your email address" },
		age: { type: "number", description: "Your age", minimum: 0, maximum: 150 },
		role: {
			type: "string",
			enum: ["admin", "user", "guest"],
			description: "User role",
		},
		notifications: {
			type: "boolean",
			description: "Enable email notifications",
			default: true,
		},
		tags: {
			type: "array",
			items: { type: "string" },
			description: "Tags for categorization",
		},
		settings: { type: "object", description: "Additional settings as JSON" },
	},
	required: ["name", "email"],
};

// Mock execute function for tool demos
export async function mockExecute(
	_toolName: string,
	params: Record<string, unknown>,
): Promise<unknown> {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	return {
		success: true,
		message: "Tool executed successfully (mock)",
		input: params,
		timestamp: new Date().toISOString(),
	};
}
