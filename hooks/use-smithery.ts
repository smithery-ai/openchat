"use client";

import Smithery from "@smithery/api";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { selectedTokenAtom } from "@/registry/new-york/smithery/tokens";

export interface UseSmitheryOptions {
	defaultNamespace: string;
	baseURL?: string;
}

export interface SmitheryData {
	token: string;
	namespace: string;
	client: Smithery;
}

export function useSmithery(options: UseSmitheryOptions) {
	const { defaultNamespace, baseURL } = options;
	const selectedToken = useAtomValue(selectedTokenAtom);

	return useQuery({
		queryKey: ["smithery", selectedToken?.token, baseURL],
		queryFn: () => {
			if (!selectedToken) {
				throw new Error("No token selected");
			}
			const client = new Smithery({
				apiKey: selectedToken.token,
				baseURL: baseURL ?? process.env.NEXT_PUBLIC_SMITHERY_API_URL,
			});
			return {
				token: selectedToken.token,
				namespace: defaultNamespace,
				client,
			} satisfies SmitheryData;
		},
		enabled: selectedToken !== null,
		staleTime: Infinity,
	});
}
