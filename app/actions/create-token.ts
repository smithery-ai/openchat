"use server";

import Smithery from "@smithery/api";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";

const SMITHERY_API_KEY = process.env.SMITHERY_API_KEY;
const SMITHERY_API_URL = process.env.NEXT_PUBLIC_SMITHERY_API_URL;
const DEFAULT_NAMESPACE = "sandbox";
const DEFAULT_TTL = "1h";

interface CreateSandboxTokenParams {
	userId: string;
	namespace?: string;
	ttl?: string | number;
}

type CreateSandboxTokenResult =
	| {
			success: true;
			token: CreateTokenResponse;
	  }
	| {
			success: false;
			error: string;
			code: "NO_API_KEY" | "NAMESPACE_NOT_FOUND" | "TOKEN_CREATION_FAILED";
	  };

export async function createSandboxToken(
	params: CreateSandboxTokenParams,
): Promise<CreateSandboxTokenResult> {
	const { userId, namespace = DEFAULT_NAMESPACE, ttl = DEFAULT_TTL } = params;

	if (!SMITHERY_API_KEY) {
		return {
			success: false,
			error: "Server is not configured with Smithery API key",
			code: "NO_API_KEY",
		};
	}

	const client = new Smithery({
		apiKey: SMITHERY_API_KEY,
		baseURL: SMITHERY_API_URL,
	});

	try {
		// Verify namespace exists
		const namespacesResponse = await client.namespaces.list();
		const namespaceExists = namespacesResponse.namespaces.some(
			(ns) => ns.name === namespace,
		);

		if (!namespaceExists) {
			return {
				success: false,
				error: `Namespace "${namespace}" does not exist. Please create it first.`,
				code: "NAMESPACE_NOT_FOUND",
			};
		}

		// Create scoped token with user isolation via metadata
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

		return {
			success: true,
			token: tokenResponse,
		};
	} catch (error) {
		console.error("Failed to create sandbox token:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			code: "TOKEN_CREATION_FAILED",
		};
	}
}
