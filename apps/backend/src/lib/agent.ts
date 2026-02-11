import type { Connection } from "@smithery/api/resources/experimental/connect/connections.mjs";
import { ToolLoopAgent, tool, type LanguageModel } from "ai";
import { claudeCode } from "ai-sdk-provider-claude-code";
import { createCodexCli } from "ai-sdk-provider-codex-cli";
import { z } from "zod";

const codexCli = createCodexCli({
	defaultSettings: {
		reasoningEffort: "medium",
		approvalMode: "on-failure",
		sandboxMode: "workspace-write",
		verbose: true,
	},
});

export function createToolLoopAgent({
	model = "anthropic/claude-haiku-4.5",
	connections = [],
}: {
	model?: string;
	connections?: Connection[];
}) {
	let modelToUse: LanguageModel = model;
	if (model.startsWith("codex/")) {
		modelToUse = codexCli(model.replace("codex/", ""));
	}
	if (model.startsWith("claude-code/")) {
		modelToUse = claudeCode(model.replace("claude-code/", ""));
	}

	const instructions = `You are a helpful assistant that can answer questions and help with tasks.
	Before calling a tool, you MUST first start a regular text response explaining what you are going to do. After calling a tool, you MUST provide a summary of the result in a regular text response.
	When calling act(), be VERY CAREFUL with the dates you use. Use the tools/date tool to resolve the date the action should be performed on.`;

	return new ToolLoopAgent({
		model: modelToUse,
		instructions: `${instructions}\n\nYou have access to the following servers:
		<servers>
		${connections
			.map(
				(connection) =>
					`<server configId="${connection.connectionId}">
						${connection.serverInfo ? JSON.stringify(connection.serverInfo) : connection.mcpUrl}
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

						const unitLower = unit.toLowerCase();
						if (unit === "M") {
							date.setMonth(date.getMonth() + value);
						} else {
							switch (unitLower) {
								case "s":
									date.setSeconds(date.getSeconds() + value);
									break;
								case "m":
									date.setMinutes(date.getMinutes() + value);
									break;
								case "h":
									date.setHours(date.getHours() + value);
									break;
								case "d":
									date.setDate(date.getDate() + value);
									break;
								case "w":
									date.setDate(date.getDate() + value * 7);
									break;
								case "y":
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
