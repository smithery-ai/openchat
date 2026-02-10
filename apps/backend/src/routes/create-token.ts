import Smithery from "@smithery/api";
import { Hono } from "hono";

export const createTokenRoute = new Hono();

const DEFAULT_NAMESPACE = "sandbox";
const DEFAULT_TTL = "1h";

createTokenRoute.post("/create-token", async (c) => {
	const { userId, namespace = DEFAULT_NAMESPACE, ttl = DEFAULT_TTL } =
		await c.req.json<{
			userId: string;
			namespace?: string;
			ttl?: string | number;
		}>();

	const SMITHERY_API_KEY = process.env.SMITHERY_API_KEY;
	const SMITHERY_API_URL = process.env.SMITHERY_API_URL;

	if (!SMITHERY_API_KEY) {
		return c.json(
			{
				success: false,
				error: "Server is not configured with Smithery API key",
				code: "NO_API_KEY",
			},
			500,
		);
	}

	const client = new Smithery({
		apiKey: SMITHERY_API_KEY,
		baseURL: SMITHERY_API_URL,
	});

	try {
		const namespacesResponse = await client.namespaces.list();
		const namespaceExists = namespacesResponse.namespaces.some(
			(ns) => ns.name === namespace,
		);

		if (!namespaceExists) {
			return c.json(
				{
					success: false,
					error: `Namespace "${namespace}" does not exist. Please create it first.`,
					code: "NAMESPACE_NOT_FOUND",
				},
				404,
			);
		}

		const tokenResponse = await client.tokens.create({
			policy: [
				{
					namespaces: [namespace],
					operations: ["read", "write"],
					resources: ["connections"],
					metadata: { user_id: userId },
					ttl,
				},
				{
					namespaces: [namespace],
					operations: ["read"],
					resources: ["servers", "skills"],
					ttl,
				},
			],
		});

		return c.json({
			success: true,
			token: tokenResponse,
		});
	} catch (error) {
		console.error("Failed to create sandbox token:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				code: "TOKEN_CREATION_FAILED",
			},
			500,
		);
	}
});
