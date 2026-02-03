"use client";

import { createContext, type ReactNode, useContext } from "react";
import {
	type UseSmitheryOptions,
	type UseSmitheryReturn,
	useSmithery,
} from "@/hooks/use-smithery";

type SmitheryContextValue = UseSmitheryReturn;

const SmitheryContext = createContext<SmitheryContextValue | null>(null);

interface SmitheryProviderProps extends UseSmitheryOptions {
	children: ReactNode;
}

export function SmitheryProvider({ children, baseURL }: SmitheryProviderProps) {
	const value = useSmithery({ baseURL });

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
