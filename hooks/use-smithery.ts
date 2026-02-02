"use client";

import Smithery from "@smithery/api";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { selectedTokenAtom } from "@/registry/new-york/smithery/tokens";

export interface UseSmitheryOptions {
	defaultNamespace: string;
	baseURL?: string;
}

export interface UseSmitheryReturn {
	token: string;
	namespace: string;
	client: Smithery;
	error: Error | null;
}

// Suspense implementation
let pendingPromise: Promise<void> | null = null;
let resolvePromise: (() => void) | null = null;

function getOrCreatePromise(): Promise<void> {
	if (!pendingPromise) {
		pendingPromise = new Promise((resolve) => {
			resolvePromise = resolve;
		});
	}
	return pendingPromise;
}

function notifyReady() {
	if (resolvePromise) {
		resolvePromise();
		pendingPromise = null;
		resolvePromise = null;
	}
}

export function useSmithery(options: UseSmitheryOptions): UseSmitheryReturn {
	const { defaultNamespace, baseURL } = options;
	const selectedToken = useAtomValue(selectedTokenAtom);

	// Notify that token is ready (resolves any suspended renders)
	useEffect(() => {
		if (selectedToken !== null) {
			notifyReady();
		}
	}, [selectedToken]);

	// Suspense: throw promise if token not ready
	if (selectedToken === null) {
		throw getOrCreatePromise();
	}

	const token = selectedToken.token;
	const namespace = defaultNamespace;

	// Memoize Smithery client instance - recreate only when token changes
	const client = useMemo(() => {
		return new Smithery({
			apiKey: token,
			baseURL: baseURL ?? process.env.NEXT_PUBLIC_SMITHERY_API_URL,
		});
	}, [token, baseURL]);

	return {
		token,
		namespace,
		client,
		error: null,
	};
}
