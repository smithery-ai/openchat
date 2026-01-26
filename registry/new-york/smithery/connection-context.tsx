"use client";

import { createContext, useContext } from "react";

// Context for connection config - consumed by ToolDetailDialog for code generation
export interface ConnectionConfig {
	mcpUrl: string;
	apiKey: string;
	namespace: string;
	connectionId: string;
}

export const ConnectionConfigContext = createContext<ConnectionConfig | null>(
	null,
);

export function useConnectionConfig() {
	return useContext(ConnectionConfigContext);
}
