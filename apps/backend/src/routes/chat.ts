import type { Connection } from "@smithery/api/resources/experimental/connect/connections.mjs";
import { createAgentUIStreamResponse, type UIMessage } from "ai";
import { Hono } from "hono";
import { createToolLoopAgent } from "../lib/agent.js";

export const chatRoute = new Hono();

chatRoute.post("/chat", async (c) => {
	const { messages, ...body } = await c.req.json<{ messages: UIMessage[] }>();
	console.log("📦 Full request messages:", JSON.stringify(messages, null, 2));
	console.log("📦 Full request body:", JSON.stringify(body, null, 2));

	const { model, connections, apiKey } = body as {
		model?: string;
		connections?: Connection[];
		apiKey?: string;
	};

	if (!apiKey) {
		return c.json(
			{
				error:
					"Smithery API key not configured. Please add SMITHERY_API_KEY to your environment variables or provide it in the request.",
			},
			401,
		);
	}

	const abortController = new AbortController();

	const params = {
		...(model ? { model } : {}),
		...(connections ? { connections } : {}),
	};

	return createAgentUIStreamResponse({
		agent: createToolLoopAgent(params),
		uiMessages: messages,
		abortSignal: abortController.signal,
		sendSources: true,
		sendReasoning: true,
	});
});
