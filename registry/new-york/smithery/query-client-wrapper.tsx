"use client";

import {
	QueryClient,
	QueryClientContext,
	QueryClientProvider,
} from "@tanstack/react-query";
import { type ReactNode, useContext, useState } from "react";

// Shared default QueryClient for all Smithery components
let sharedQueryClient: QueryClient | null = null;

function getSharedQueryClient() {
	if (!sharedQueryClient) {
		sharedQueryClient = new QueryClient({
			defaultOptions: {
				queries: { staleTime: 60 * 1000 },
			},
		});
	}
	return sharedQueryClient;
}

/**
 * Wrapper that auto-provides QueryClient if none exists.
 * - If a QueryClientProvider already exists, uses that client (user's takes precedence)
 * - If no provider exists, creates a shared client for Smithery components
 */
export function WithQueryClient({ children }: { children: ReactNode }) {
	// Check if we're already inside a QueryClientProvider
	const existingClient = useContext(QueryClientContext);

	// Create our own client only if needed (lazy init, stable across renders)
	const [fallbackClient] = useState(() => getSharedQueryClient());

	// If there's already a client, just render children
	if (existingClient) {
		return <>{children}</>;
	}

	// Otherwise, provide our own client
	return (
		<QueryClientProvider client={fallbackClient}>
			{children}
		</QueryClientProvider>
	);
}
