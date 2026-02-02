"use client";

import type Smithery from "@smithery/api";
import { createContext, type ReactNode, useContext } from "react";
import { type UseSmitheryOptions, useSmithery } from "@/hooks/use-smithery";

interface SmitheryContextValue {
	token: string;
	namespace: string;
	client: Smithery;
	error: Error | null;
}

const SmitheryContext = createContext<SmitheryContextValue | null>(null);

interface SmitheryProviderProps extends UseSmitheryOptions {
	children: ReactNode;
}

export function SmitheryProvider({
	children,
	defaultNamespace,
	baseURL,
}: SmitheryProviderProps) {
	const value = useSmithery({ defaultNamespace, baseURL });

	return (
		<SmitheryContext.Provider value={value}>
			{children}
		</SmitheryContext.Provider>
	);
}

export function useSmitheryContext(): SmitheryContextValue {
	const context = useContext(SmitheryContext);
	if (!context) {
		throw new Error(
			"useSmitheryContext must be used within a SmitheryProvider",
		);
	}
	return context;
}
