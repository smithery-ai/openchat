"use client";

import Smithery from "@smithery/api";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

export const selectedTokenAtom = atom<CreateTokenResponse | null>(null);
export const selectedNamespaceAtom = atom<string | null>(null);

export interface UseSmitheryOptions {
	baseURL?: string;
	smitheryApiKey?: string;
}

export interface UseSmitheryReturn {
	createNamespace(name: string): Promise<string>;
	token: string;
	namespace: string;
	setNamespace(namespace: string): void;
	namespaces: string[];
	loading: boolean;
	error?: Error;
	connected: boolean;
	client: Smithery;
}

export function useSmithery(
	options: UseSmitheryOptions = {},
): UseSmitheryReturn {
	const { baseURL, smitheryApiKey } = options;

	const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
	const [tokenLoading, setTokenLoading] = useState(true);
	const [tokenError, setTokenError] = useState<Error | undefined>();

	// Namespace state
	const [selectedNamespace, setSelectedNamespace] = useAtom(
		selectedNamespaceAtom,
	);

	// Create Smithery client
	const client = useMemo(() => {
		return new Smithery({
			apiKey: selectedToken?.token ?? "",
			baseURL: baseURL ?? process.env.NEXT_PUBLIC_SMITHERY_API_URL,
		});
	}, [selectedToken?.token, baseURL]);

	// Fetch namespaces when we have a valid token
	const namespacesQuery = useQuery({
		queryKey: ["namespaces", selectedToken?.token],
		queryFn: async () => {
			const response = await client.namespaces.list();
			return response.namespaces.map((ns) => ns.name);
		},
		enabled: !!selectedToken?.token,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Initialize selected token from the server-provided API key
	useEffect(() => {
		if (!smitheryApiKey) {
			setSelectedToken(null);
			setTokenError(
				new Error(
					"Smithery API key is not configured. Set SMITHERY_API_KEY on the server.",
				),
			);
			setTokenLoading(false);
			return;
		}
		const tokenResponse: CreateTokenResponse = {
			token: smitheryApiKey,
			expiresAt: "never",
		};
		setSelectedToken(tokenResponse);
		setTokenError(undefined);
		setTokenLoading(false);
	}, [smitheryApiKey, setSelectedToken]);

	// Auto-select first namespace if none selected
	useEffect(() => {
		const namespaces = namespacesQuery.data;
		if (!namespaces || namespaces.length === 0) return;
		if (!selectedNamespace || !namespaces.includes(selectedNamespace)) {
			setSelectedNamespace(namespaces[0]);
		}
	}, [selectedNamespace, namespacesQuery.data, setSelectedNamespace]);

	// Set namespace function
	const setNamespace = useCallback(
		(namespace: string) => {
			setSelectedNamespace(namespace);
		},
		[setSelectedNamespace],
	);

	// Create namespace function (uses SDK directly)
	const createNamespace = useCallback(
		async (name: string): Promise<string> => {
			if (!selectedToken?.token) {
				throw new Error(
					"Cannot create namespace: not connected to Smithery service",
				);
			}
			try {
				const response = await client.namespaces.set(name);
				await namespacesQuery.refetch();
				setSelectedNamespace(response.name);
				return response.name;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Unknown error occurred";
				throw new Error(`Failed to create namespace "${name}": ${message}`);
			}
		},
		[client, namespacesQuery, selectedToken?.token, setSelectedNamespace],
	);

	// Combined loading state
	// Only consider namespace query loading if we have a token (query is enabled)
	const loading =
		tokenLoading || (!!selectedToken?.token && namespacesQuery.isPending);

	// Combined error state
	const queryError = namespacesQuery.error
		? namespacesQuery.error instanceof Error
			? namespacesQuery.error
			: new Error(String(namespacesQuery.error))
		: undefined;
	const error = tokenError ?? queryError;

	// Connected if we have a token and no connection error
	const connected = !!selectedToken?.token && !tokenError;

	return {
		createNamespace,
		token: selectedToken?.token ?? "",
		namespace: selectedNamespace ?? "",
		setNamespace,
		namespaces: namespacesQuery.data ?? [],
		loading,
		error,
		connected,
		client,
	};
}
