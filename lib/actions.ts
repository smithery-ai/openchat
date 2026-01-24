"use server";

import { randomUUID } from "node:crypto";
import Smithery from "@smithery/api";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";

const client = new Smithery({
	apiKey: process.env.SMITHERY_API_KEY,
	baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
});

export async function getDefaultNamespace() {
	const response = await client.namespaces.list();
	return response.namespaces[0].name;
}

export async function createToken({
	ttlSeconds,
	userId,
}: {
	ttlSeconds: number;
	userId: string;
}) {
	const namespace = await getDefaultNamespace();
	const response = await client.tokens.create({
		allow: {
			connections: {
				actions: ["write", "read"],
				namespaces: [namespace],
				metadata: {
					userId,
				},
			},
			rpc: {
				actions: ["read", "write"],
				namespaces: [namespace],
				metadata: {
					userId,
				},
			},
			namespaces: {
				actions: ["read", "write"],
				namespaces: [namespace],
			},
		},
		ttlSeconds,
	});
	return response;
}

export async function getApiKey(): Promise<CreateTokenResponse> {
	if (process.env.NODE_ENV === "development" && process.env.SMITHERY_API_KEY)
		return {
			token: process.env.SMITHERY_API_KEY,
			expiresAt: "never",
		};
	return await createToken({ ttlSeconds: 60 * 60 * 24, userId: randomUUID() });
}
