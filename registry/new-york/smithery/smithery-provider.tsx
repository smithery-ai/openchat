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

function ConnectionError({ error }: { error: Error }) {
	return (
		<div className="absolute inset-0">
			<div className="flex items-center justify-center h-full p-8">
				<div className="max-w-md text-center space-y-4">
					<div className="text-destructive text-lg font-medium">
						Connection Error
					</div>
					<p className="text-muted-foreground">{error.message}</p>
				</div>
			</div>
		</div>
	);
}

export function SmitheryProvider({
	children,
	baseURL,
	smitheryApiKey,
}: SmitheryProviderProps) {
	const value = useSmithery({ baseURL, smitheryApiKey });

	if (value.error && !value.loading) {
		return (
			<SmitheryContext.Provider value={value}>
				<ConnectionError error={value.error} />
			</SmitheryContext.Provider>
		);
	}

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
