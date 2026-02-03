"use client";

import Smithery from "@smithery/api";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	createToken as createTokenAction,
	listNamespaces,
} from "@/lib/actions";
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
	token: string;
	tokenExpiresAt: string;
	namespace: string;
	setNamespace(namespace: string): void;
	namespaces: string[];
	loading: boolean;
	error?: Error;
	client: Smithery;
}

async function fetchOrCreateToken(
	hasExistingTokens: boolean,
	forceCreate?: boolean,
): Promise<CreateTokenResponse | null> {
	// Force create skips whoami
	if (forceCreate) {
		return createTokenAction({
			ttlSeconds: 60 * 60 * 24,
		});
	}

	// Try localhost whoami first
	try {
		const response = await fetch("http://localhost:4260/whoami");
		if (response.ok) {
			const data = await response.json();
			if (data.SMITHERY_API_KEY) {
				return {
					token: data.SMITHERY_API_KEY,
					expiresAt: data.expiresAt ?? "never",
				};
			}
		}
	} catch {
		// whoami not available
	}

	// If we have existing tokens, don't mint
	if (hasExistingTokens) {
		return null;
	}

	// Mint a new token
	return createTokenAction({
		ttlSeconds: 60 * 60 * 24,
	});
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

	// Fetch namespaces
	const namespacesQuery = useQuery({
		queryKey: ["namespaces"],
		queryFn: listNamespaces,
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
				const hasExistingTokens = tokensCreated.length > 0;
				const tokenResponse = await fetchOrCreateToken(hasExistingTokens);

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
	}, [hydrated, setSelectedToken, setTokensCreated, tokensCreated.length]);

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

	// Create token function
	const createToken = useCallback(async (): Promise<string> => {
		const tokenResponse = await fetchOrCreateToken(true, true);
		if (tokenResponse) {
			setTokensCreated((prev) => [...prev, tokenResponse]);
			setSelectedToken(tokenResponse);
			return tokenResponse.token;
		}
		throw new Error("Failed to create token");
	}, [setTokensCreated, setSelectedToken]);

	// Set namespace function
	const setNamespace = useCallback(
		(namespace: string) => {
			setSelectedNamespace(namespace);
		},
		[setSelectedNamespace],
	);

	// Create Smithery client
	const client = useMemo(() => {
		return new Smithery({
			apiKey: selectedToken?.token ?? "",
			baseURL: baseURL ?? process.env.NEXT_PUBLIC_SMITHERY_API_URL,
		});
	}, [selectedToken?.token, baseURL]);

	// Combined loading state
	const loading = tokenLoading || namespacesQuery.isPending;

	// Combined error state
	const error = tokenError ?? namespacesQuery.error ?? undefined;

	return {
		createToken,
		token: selectedToken?.token ?? "",
		tokenExpiresAt: selectedToken?.expiresAt ?? "",
		namespace: selectedNamespace ?? "",
		setNamespace,
		namespaces: namespacesQuery.data ?? [],
		loading,
		error,
		client,
	};
}
