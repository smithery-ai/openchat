"use client";

import { createContext, type ReactNode, useContext } from "react";
import {
	CodeBlock,
	CodeBlockCopyButton,
} from "./code-block";
import {
	type CreateSandboxTokenFn,
	SmitheryConnectionError,
	type UseSmitheryOptions,
	type UseSmitheryReturn,
	useSmithery,
} from "../hooks/use-smithery";

type SmitheryContextValue = UseSmitheryReturn;

const SmitheryContext = createContext<SmitheryContextValue | null>(null);

interface SmitheryProviderProps {
	children: ReactNode;
	baseURL: string;
	backendUrl: string;
	createSandboxToken?: CreateSandboxTokenFn;
}

function ConnectionError({ error }: { error: Error }) {
	const isServiceUnavailable =
		error instanceof SmitheryConnectionError && error.isServiceUnavailable;
	const command = "npx @smithery/cli@latest whoami --server";
	const { client } = useSmitheryContext();
	console.log("[ConnectionError] Rendering with client.apiKey:", client?.apiKey ? `${client.apiKey.slice(0, 8)}...` : "(empty)");

	return (
		<div className="absolute inset-0">
			<div className="flex items-center justify-center h-full p-8">
				<div className="max-w-md text-center space-y-4">
					<div className="text-destructive text-lg font-medium">
						{isServiceUnavailable
							? "Unable to connect to Smithery"
							: "Connection Error"}
					</div>
					<p className="text-muted-foreground">{error.message}</p>
					{isServiceUnavailable && (
						<CodeBlock code={command} language="bash">
							<CodeBlockCopyButton />
						</CodeBlock>
					)}
					<p>{client?.apiKey}</p>
				</div>
			</div>
		</div>
	);
}

export function SmitheryProvider({ children, baseURL, backendUrl, createSandboxToken }: SmitheryProviderProps) {
	const value = useSmithery({ baseURL, backendUrl, createSandboxToken });

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
