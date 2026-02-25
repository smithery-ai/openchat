"use client";

import Smithery from "@smithery/api";
import { useQuery } from "@tanstack/react-query";
import { atom, useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

export const selectedNamespaceAtom = atom<string | null>(null);

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

export function useSmithery(smitheryApiKey: string): UseSmitheryReturn {
	const [selectedNamespace, setSelectedNamespace] = useAtom(
		selectedNamespaceAtom,
	);
	const [apiKeyError, setApiKeyError] = useState<Error | undefined>();
	const token = smitheryApiKey.trim();

	useEffect(() => {
		if (!token) {
			setApiKeyError(
				new Error(
					"Missing Smithery API key. Set SMITHERY_API_KEY in your server environment.",
				),
			);
			return;
		}
		setApiKeyError(undefined);
	}, [token]);

	const client = useMemo(() => {
		return new Smithery({
			apiKey: token,
			baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
		});
	}, [token]);

	const namespacesQuery = useQuery({
		queryKey: ["namespaces", token],
		queryFn: async () => {
			const response = await client.namespaces.list();
			return response.namespaces.map((ns) => ns.name);
		},
		enabled: !!token,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	useEffect(() => {
		if (!namespacesQuery.data) return;
		if (!selectedNamespace && namespacesQuery.data.length > 0) {
			setSelectedNamespace(namespacesQuery.data[0]);
			return;
		}
		if (
			selectedNamespace &&
			!namespacesQuery.data.includes(selectedNamespace)
		) {
			setSelectedNamespace(namespacesQuery.data[0] ?? null);
		}
	}, [selectedNamespace, namespacesQuery.data, setSelectedNamespace]);

	const setNamespace = useCallback(
		(namespace: string) => {
			setSelectedNamespace(namespace);
		},
		[setSelectedNamespace],
	);

	const createNamespace = useCallback(
		async (name: string): Promise<string> => {
			if (!token) {
				throw new Error("Cannot create namespace: missing Smithery API key");
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
		[client, namespacesQuery, setSelectedNamespace, token],
	);

	const loading = !!token && namespacesQuery.isPending;
	const error = apiKeyError ?? namespacesQuery.error ?? undefined;
	const connected = !!token && !error;

	return {
		createNamespace,
		token,
		namespace: selectedNamespace ?? "",
		setNamespace,
		namespaces: namespacesQuery.data ?? [],
		loading,
		error,
		connected,
		client,
	};
}
