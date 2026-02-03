"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import {
	type SmitheryData,
	type UseSmitheryOptions,
	useSmithery,
} from "@/hooks/use-smithery";

type SmitheryContextValue = UseQueryResult<SmitheryData, Error>;

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
