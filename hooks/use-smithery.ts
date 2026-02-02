"use client";

import Smithery from "@smithery/api";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { selectedTokenAtom } from "@/registry/new-york/smithery/tokens";

export interface UseSmitheryOptions {
	defaultNamespace?: string | null;
	baseURL?: string;
}

export interface UseSmitheryReturn {
	token: string | undefined;
	namespace: string | undefined;
	client: Smithery | null;
	isLoading: boolean;
	error: Error | null;
}

export function useSmithery(
	options: UseSmitheryOptions = {},
): UseSmitheryReturn {
	const { defaultNamespace, baseURL } = options;
	const selectedToken = useAtomValue(selectedTokenAtom);

	const token = selectedToken?.token ?? undefined;
	const namespace = defaultNamespace ?? undefined;

	// Memoize Smithery client instance - recreate only when token changes
	const client = useMemo(() => {
		if (!token) return null;
		return new Smithery({
			apiKey: token,
			baseURL: baseURL ?? process.env.NEXT_PUBLIC_SMITHERY_API_URL,
		});
	}, [token, baseURL]);

	// Loading state based on token availability
	// The token is considered "loading" until it's set via the Tokens component
	const isLoading = selectedToken === null;

	return {
		token,
		namespace,
		client,
		isLoading,
		error: null,
	};
}
