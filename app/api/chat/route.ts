import type { ServerListResponse } from "@smithery/api/resources/servers/servers.mjs";
import {
	createAgentUIStreamResponse,
	ToolLoopAgent,
	tool,
	type UIMessage,
} from "ai";
import { z } from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

function createToolLoopAgent({
	instructions = `You are a helpful assistant that can answer questions and help with tasks. 
	Before calling a tool, you MUST first start a regular text response explaining what you are going to do. After calling a tool, you MUST provide a summary of the result in a regular text response.
	When calling act(), be VERY CAREFUL with the dates you use. Use the tools/date tool to resolve the date the action should be performed on.`,
	model = "anthropic/claude-haiku-4.5",
	servers = [],
}: {
	instructions?: string;
	model?: string;
	servers?: {
		connectionConfig: ConnectionConfig;
		server?: ServerListResponse;
	}[];
}) {
	return new ToolLoopAgent({
		model,
		instructions: `${instructions}\n\nYou have access to the following servers: 
		<servers>
		${servers
			.map(
				(server) =>
					`<server configId="${server.connectionConfig.configId}">
						${server.server ? JSON.stringify(server.server) : server.connectionConfig.serverUrl}
					</server>`,
			)
			.join("\n")}
		</servers>`,
		tools: {
			date: tool({
				description:
					"Get the current date and time. Use this to resolve dates for actions.",
				inputSchema: z.object({
					addOrSubtract: z
						.string()
						.describe(
							"The value to add or subtract from the current date. Use '-3d' for 3 days ago, '+1w' for 1 week from now, '+2M' for 2 months, '-1y' for 1 year ago, '+5h' for 5 hours, etc. Format: [+/-][number][unit] where unit is: s (seconds), m (minutes), h (hours), d (days), w (weeks), M (months), y (years).",
						)
						.optional(),
				}),
				execute: async ({ addOrSubtract }) => {
					const date = new Date();

					if (addOrSubtract) {
						// Parse format: [+/-][number][unit]
						// Examples: '-3d', '+1w', '+2M', '-1y', '+5h'
						const match = addOrSubtract.match(/^([+-]?)(\d+)([smhdwMy])$/i);

						if (!match) {
							throw new Error(
								`Invalid date format: "${addOrSubtract}". Expected format: [+/-][number][unit] (e.g., '-3d', '+1w', '+2M'). Units: s (seconds), m (minutes), h (hours), d (days), w (weeks), M (months), y (years)`,
							);
						}

						const [, sign, amountStr, unit] = match;
						const amount = Number.parseInt(amountStr, 10);
						const multiplier = sign === "-" ? -1 : 1;
						const value = amount * multiplier;

						// Apply the offset based on the unit
						// Note: 'M' (uppercase) is months, 'm' (lowercase) is minutes
						const unitLower = unit.toLowerCase();
						if (unit === "M") {
							// Months (uppercase M)
							date.setMonth(date.getMonth() + value);
						} else {
							switch (unitLower) {
								case "s": // seconds
									date.setSeconds(date.getSeconds() + value);
									break;
								case "m": // minutes
									date.setMinutes(date.getMinutes() + value);
									break;
								case "h": // hours
									date.setHours(date.getHours() + value);
									break;
								case "d": // days
									date.setDate(date.getDate() + value);
									break;
								case "w": // weeks
									date.setDate(date.getDate() + value * 7);
									break;
								case "y": // years
									date.setFullYear(date.getFullYear() + value);
									break;
								default:
									throw new Error(
										`Unknown time unit: "${unit}". Supported units: s, m, h, d, w, M, y`,
									);
							}
						}
					}

					return { date: date.toISOString() };
				},
			}),
			useServer: tool({
				description:
					"Search for MCP servers (sets of tools) to help with the user's request. The servers are like 'gmail', 'notion', etc. i.e. a collection of tools that can be used to achieve a specific task.",
				inputSchema: z.object({
					query: z
						.string()
						.describe(
							"The query to search for MCP servers. Make this as specific and descriptive as possible to help the user get the best results.",
						),
				}),
			}),
			act: tool({
				description:
					"Search for a tool to enact on the user's request. This is for ONE SINGLE ACTION, think the equivalent of ONE API CALL. It is imperative that when referring to dates, try NOT to use relative dates, but rather use the date tool to get the exact date you need.",
				inputSchema: z.object({
					action: z
						.string()
						.describe(
							"The action to perform. Think of this as a keyword search for a single API call, like 'fetch emails' or 'get weather' or 'send email'.",
						),
					servers: z
						.array(
							z.object({
								configId: z.string(),
							}),
						)
						.describe(
							"The candidate servers that can potentially perform the action. Use this to refine search or leave empty to search all servers. If in doubt, you can add multiple servers. Reference the server by connection configuration ID (configId).",
						),
				}),
			}),
		},
	});
}

export async function POST(request: Request) {
	const { messages, ...body }: { messages: UIMessage[] } = await request.json();
	console.log("📦 Full request messages:", JSON.stringify(messages, null, 2));
	console.log("📦 Full request body:", JSON.stringify(body, null, 2));

	// Extract API key from body or use env var
	const { model, instructions, servers, apiKey } = body as {
		model?: string;
		instructions?: string;
		apiKey?: string;
		servers?: {
			connectionConfig: ConnectionConfig;
			server?: ServerListResponse;
		}[];
	};

	// Validate API key - accept from body or env
	const effectiveApiKey = apiKey || process.env.SMITHERY_API_KEY;
	if (!effectiveApiKey) {
		return new Response(
			JSON.stringify({
				error:
					"Smithery API key not configured. Please add SMITHERY_API_KEY to your environment variables or provide it in the request.",
			}),
			{
				status: 401,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Optional: support cancellation (aborts on disconnect, etc.)
	const abortController = new AbortController();

	const params = {
		...(model ? { model } : {}),
		...(instructions ? { instructions } : {}),
		...(servers ? { servers } : {}),
	};

	return createAgentUIStreamResponse({
		agent: createToolLoopAgent(params),
		uiMessages: messages,
		abortSignal: abortController.signal, // optional
		sendSources: true,
		sendReasoning: true,
	});
}
