"use server";

import Smithery from "@smithery/api";
import { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { v4 as uuidv4 } from "uuid";

const client = new Smithery({
	apiKey: process.env.SMITHERY_API_KEY,
	baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
});

export async function createNamespace() {
	const response = await client.namespaces.set(`sandbox-${uuidv4()}`);
	return response.name;
}

export async function getDefaultNamespace() {
	const response = await client.namespaces.list();
	return response.namespaces[0].name;
}

export async function createToken({ttlSeconds, userId}: {ttlSeconds: number, userId: string}) {
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
	const apiKey = process.env.SMITHERY_API_KEY;
	if (!apiKey) {
		throw new Error("SMITHERY_API_KEY is not set");
	}
	return {
		token: apiKey,
		expiresAt: "never",
	};
}
