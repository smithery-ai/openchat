"use client";

import Smithery from "@smithery/api";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterExpiredTokens, isTokenExpired } from "@/lib/utils";

// Jotai atoms for state management
export const tokensCreatedAtom = atomWithStorage<CreateTokenResponse[]>(
	"tokensCreated",
	[],
);
export const selectedTokenAtom = atom<CreateTokenResponse | null>(null);
export const selectedNamespaceAtom = atom<string | null>(null);

export interface UseSmitheryOptions {
	baseURL?: string;
}

export interface UseSmitheryReturn {
	createToken(): Promise<string>;
	createNamespace(name: string): Promise<string>;
	token: string;
	tokenExpiresAt: string;
	namespace: string;
	setNamespace(namespace: string): void;
	namespaces: string[];
	loading: boolean;
	error?: Error;
	connected: boolean;
	client: Smithery;
}

export { SmitheryConnectionError };

class SmitheryConnectionError extends Error {
	constructor(
		message: string,
		public readonly isServiceUnavailable: boolean,
	) {
		super(message);
		this.name = "SmitheryConnectionError";
	}
}

async function fetchTokenFromWhoami(): Promise<CreateTokenResponse> {
	let response: Response;
	try {
		response = await fetch("http://localhost:4260/whoami");
	} catch {
		throw new SmitheryConnectionError(
			"Unable to connect to Smithery service. Make sure the Smithery agent is running on localhost:4260.",
			true,
		);
	}

	if (!response.ok) {
		throw new SmitheryConnectionError(
			`Smithery service returned an error: ${response.status} ${response.statusText}`,
			false,
		);
	}

	const data = await response.json();
	if (!data.SMITHERY_API_KEY) {
		throw new SmitheryConnectionError(
			"Smithery service did not return an API key. Please check your Smithery configuration.",
			false,
		);
	}

	return {
		token: data.SMITHERY_API_KEY,
		expiresAt: data.expiresAt ?? "never",
	};
}

export function useSmithery(
	options: UseSmitheryOptions = {},
): UseSmitheryReturn {
	const { baseURL } = options;

	// Token state
	const [tokensCreated, setTokensCreated] = useAtom(tokensCreatedAtom);
	const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
	const [tokenLoading, setTokenLoading] = useState(true);
	const [tokenError, setTokenError] = useState<Error | undefined>();
	const [hydrated, setHydrated] = useState(false);
	const fetchStarted = useRef(false);

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

	// Fetch namespaces (only when we have a valid token)
	const namespacesQuery = useQuery({
		queryKey: ["namespaces", selectedToken?.token],
		queryFn: async () => {
			const response = await client.namespaces.list();
			return response.namespaces.map((ns) => ns.name);
		},
		enabled: !!selectedToken?.token,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Wait for atom to hydrate
	useEffect(() => {
		setHydrated(true);
	}, []);

	// Filter expired tokens after hydration
	useEffect(() => {
		if (!hydrated) return;
		setTokensCreated((current) => {
			const validTokens = filterExpiredTokens(current);
			if (validTokens.length !== current.length) {
				return validTokens;
			}
			return current;
		});
	}, [hydrated, setTokensCreated]);

	// Fetch token after hydration
	useEffect(() => {
		if (!hydrated) return;
		if (fetchStarted.current) return;
		fetchStarted.current = true;

		async function fetchToken() {
			try {
				const tokenResponse = await fetchTokenFromWhoami();

				if (tokenResponse) {
					setTokensCreated((current) => {
						const alreadyExists = current.some(
							(t) => t.token === tokenResponse.token,
						);
						if (alreadyExists) return current;
						return [tokenResponse, ...current];
					});
					setSelectedToken(tokenResponse);
				}
			} catch (err) {
				setTokenError(err instanceof Error ? err : new Error(String(err)));
			} finally {
				setTokenLoading(false);
			}
		}

		fetchToken();
	}, [hydrated, setSelectedToken, setTokensCreated]);

	// Select first valid token if none selected or current selection is expired
	useEffect(() => {
		const needsNewSelection = !selectedToken || isTokenExpired(selectedToken);
		if (needsNewSelection && tokensCreated.length > 0) {
			const validToken = tokensCreated.find((t) => !isTokenExpired(t));
			if (validToken) setSelectedToken(validToken);
		}
	}, [selectedToken, setSelectedToken, tokensCreated]);

	// Auto-select first namespace if none selected
	useEffect(() => {
		if (
			!selectedNamespace &&
			namespacesQuery.data &&
			namespacesQuery.data.length > 0
		) {
			setSelectedNamespace(namespacesQuery.data[0]);
		}
	}, [selectedNamespace, namespacesQuery.data, setSelectedNamespace]);

	// Create token function (refreshes from /whoami)
	const createToken = useCallback(async (): Promise<string> => {
		const tokenResponse = await fetchTokenFromWhoami();
		if (tokenResponse) {
			setTokensCreated((prev) => [...prev, tokenResponse]);
			setSelectedToken(tokenResponse);
			return tokenResponse.token;
		}
		throw new Error("Failed to fetch token from /whoami");
	}, [setTokensCreated, setSelectedToken]);

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
	const error = tokenError ?? namespacesQuery.error ?? undefined;

	// Connected if we have a token and no connection error
	const connected = !!selectedToken?.token && !tokenError;

	return {
		createToken,
		createNamespace,
		token: selectedToken?.token ?? "",
		tokenExpiresAt: selectedToken?.expiresAt ?? "",
		namespace: selectedNamespace ?? "",
		setNamespace,
		namespaces: namespacesQuery.data ?? [],
		loading,
		error,
		connected,
		client,
	};
}
