"use server";

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

export async function createToken({ ttlSeconds }: { ttlSeconds: number }) {
	const namespace = await getDefaultNamespace();
	const response = await client.tokens.create({
		policy: [
			{
				namespaces: [namespace],
				operations: ["read", "write"],
				resources: ["connections", "namespaces"],
				ttl: ttlSeconds,
			},
		],
	});
	return response;
}

export async function getApiKey(): Promise<CreateTokenResponse> {
	// if (process.env.NODE_ENV === "development" && process.env.SMITHERY_API_KEY)
	// 	return {
	// 		token: process.env.SMITHERY_API_KEY,
	// 		expiresAt: "never",
	// 	};
	return await createToken({ ttlSeconds: 60 * 60 * 24 });
}
