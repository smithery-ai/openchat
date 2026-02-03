"use client";

import Smithery from "@smithery/api";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSandboxToken } from "@/app/actions/create-token";
import { filterExpiredTokens, isTokenExpired } from "@/lib/utils";

// Jotai atoms for state management
export const tokensCreatedAtom = atomWithStorage<CreateTokenResponse[]>(
	"tokensCreated",
	[],
);
export const selectedTokenAtom = atom<CreateTokenResponse | null>(null);
export const selectedNamespaceAtom = atom<string | null>(null);
export const userIdAtom = atomWithStorage<string | null>(
	"smithery_user_id",
	null,
);
export const sandboxModeAtom = atom<boolean>(false);

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
	sandboxMode: boolean;
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

	// User ID for sandbox mode isolation
	const [userId, setUserId] = useAtom(userIdAtom);
	const [sandboxMode, setSandboxMode] = useAtom(sandboxModeAtom);
	const userIdRef = useRef<string | null>(null);

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

	// Fetch namespaces (only when we have a valid token and NOT in sandbox mode)
	// Sandbox mode tokens don't have namespaces:read permission
	const namespacesQuery = useQuery({
		queryKey: ["namespaces", selectedToken?.token, sandboxMode],
		queryFn: async () => {
			// In sandbox mode, we only have access to "sandbox" namespace
			if (sandboxMode) {
				return ["sandbox"];
			}
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

	// Generate user ID if not exists (for sandbox mode isolation)
	useEffect(() => {
		if (!hydrated) return;
		if (!userId) {
			const newUserId = crypto.randomUUID();
			setUserId(newUserId);
			userIdRef.current = newUserId;
		} else {
			userIdRef.current = userId;
		}
	}, [hydrated, userId, setUserId]);

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
					setSandboxMode(false);
				}
			} catch (err) {
				// Fallback to server-side token creation when whoami is unavailable
				if (
					err instanceof SmitheryConnectionError &&
					err.isServiceUnavailable
				) {
					const currentUserId = userIdRef.current;
					if (!currentUserId) {
						// Wait for userId to be generated, retry later
						fetchStarted.current = false;
						setTokenLoading(false);
						return;
					}

					try {
						const result = await createSandboxToken({ userId: currentUserId });
						if (result.success) {
							setTokensCreated((current) => {
								const alreadyExists = current.some(
									(t) => t.token === result.token.token,
								);
								if (alreadyExists) return current;
								return [result.token, ...current];
							});
							setSelectedToken(result.token);
							setSandboxMode(true);
							setSelectedNamespace("sandbox");
						} else {
							setTokenError(new Error(result.error));
						}
					} catch (sandboxErr) {
						setTokenError(
							sandboxErr instanceof Error
								? sandboxErr
								: new Error(String(sandboxErr)),
						);
					}
				} else {
					setTokenError(err instanceof Error ? err : new Error(String(err)));
				}
			} finally {
				setTokenLoading(false);
			}
		}

		fetchToken();
	}, [
		hydrated,
		setSelectedToken,
		setTokensCreated,
		setSandboxMode,
		setSelectedNamespace,
	]);

	// Select first valid token if none selected or current selection is expired
	useEffect(() => {
		const needsNewSelection = !selectedToken || isTokenExpired(selectedToken);
		if (needsNewSelection && tokensCreated.length > 0) {
			const validToken = tokensCreated.find((t) => !isTokenExpired(t));
			if (validToken) setSelectedToken(validToken);
		}
	}, [selectedToken, setSelectedToken, tokensCreated]);

	// Poll whoami when in sandbox mode to check if service comes back online
	useEffect(() => {
		if (!sandboxMode || !hydrated) return;

		const POLL_INTERVAL_MS = 3000;

		const intervalId = setInterval(async () => {
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
					setSandboxMode(false);
				}
			} catch {
				// Service still unavailable, continue polling
			}
		}, POLL_INTERVAL_MS);

		return () => clearInterval(intervalId);
	}, [sandboxMode, hydrated, setTokensCreated, setSelectedToken, setSandboxMode]);

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
		sandboxMode,
	};
}
