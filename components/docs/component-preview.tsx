"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import Smithery from "@smithery/api";
import { createConnection } from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/experimental/connect/connections.mjs";
import { useQuery } from "@tanstack/react-query";
import type { Tool, ToolExecutionOptions } from "ai";
import { useAtomValue } from "jotai";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { selectedTokenAtom } from "@/hooks/use-smithery";
import { ConnectionConfigContext } from "@/registry/new-york/smithery/connection-context";
import { PreviewFrame } from "./preview-frame";

const DEFAULT_MCP_URL = "https://mcp.exa.ai";

const getSmitheryClient = (token: string) => {
	return new Smithery({
		apiKey: token,
		baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	});
};

function useConnections(
	token: string | undefined,
	namespace: string | undefined,
) {
	return useQuery({
		queryKey: ["connections", token, namespace],
		queryFn: async () => {
			if (!token) throw new Error("Token required");
			if (!namespace) throw new Error("Namespace required");
			const client = getSmitheryClient(token);
			const { connections } =
				await client.experimental.connect.connections.list(namespace);
			return { connections, namespace };
		},
		enabled: !!token && !!namespace,
	});
}

function useConnectionTools(
	token: string | undefined,
	connectionId: string | null,
	namespace: string | undefined,
) {
	const clientQuery = useQuery({
		queryKey: ["mcp-client", token, connectionId, namespace],
		queryFn: async () => {
			if (!token || !connectionId)
				throw new Error("Token and connection required");
			if (!namespace) throw new Error("Namespace required");
			const { transport } = await createConnection({
				client: getSmitheryClient(token),
				connectionId,
				namespace,
			});
			const mcpClient = await createMCPClient({ transport });
			return { client: mcpClient, namespace };
		},
		enabled: !!token && !!connectionId && !!namespace,
	});

	const toolsQuery = useQuery({
		queryKey: ["tools", connectionId, token, namespace],
		queryFn: async () => {
			if (!clientQuery.data) throw new Error("Client not available");
			return await clientQuery.data.client.tools();
		},
		enabled: !!clientQuery.data,
	});

	const handleExecute = async (
		toolName: string,
		params: Record<string, unknown>,
	) => {
		if (!toolsQuery.data) throw new Error("Tools not available");
		const tool = toolsQuery.data[toolName];
		if (!tool) throw new Error(`Tool ${toolName} not found`);
		const options: ToolExecutionOptions = {
			toolCallId: `manual-${Date.now()}`,
			messages: [],
		};
		return await tool.execute(params, options);
	};

	return {
		tools: toolsQuery.data,
		isLoading: clientQuery.isLoading || toolsQuery.isLoading,
		error: clientQuery.error || toolsQuery.error,
		handleExecute,
		namespace: clientQuery.data?.namespace,
	};
}

function ConnectionSelector({
	token,
	namespace,
	selectedConnectionId,
	onSelect,
}: {
	token: string;
	namespace: string;
	selectedConnectionId: string | null;
	onSelect: (connectionId: string | null) => void;
}) {
	const { data, isLoading, error } = useConnections(token, namespace);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Spinner className="h-4 w-4" />
				Loading connections...
			</div>
		);
	}

	if (error) {
		return (
			<div className="text-sm text-destructive">
				Error loading connections: {error.message}
			</div>
		);
	}

	if (!data?.connections.length) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<AlertCircle className="h-4 w-4" />
				No connections found. Connect to{" "}
				<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
					{DEFAULT_MCP_URL}
				</code>{" "}
				first.
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<span className="text-sm text-muted-foreground">Connection:</span>
			<Select
				value={selectedConnectionId || ""}
				onValueChange={(value) => onSelect(value || null)}
			>
				<SelectTrigger className="w-[280px]">
					<SelectValue placeholder="Select a connection" />
				</SelectTrigger>
				<SelectContent>
					{data.connections.map((connection: Connection) => (
						<SelectItem
							key={connection.connectionId}
							value={connection.connectionId}
						>
							{connection.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

interface ComponentPreviewProps {
	component: string;
	namespace: string;
	requiresConnection?: boolean;
	children:
		| React.ReactNode
		| ((props: {
				tools: Record<string, Tool>;
				handleExecute: (
					toolName: string,
					params: Record<string, unknown>,
				) => Promise<unknown>;
				connectionConfig: {
					mcpUrl: string;
					apiKey: string;
					namespace: string;
					connectionId: string;
				};
				selectedToolName: string | null;
				setSelectedToolName: (name: string | null) => void;
		  }) => React.ReactNode);
}

export function ComponentPreview({
	component: _component,
	namespace,
	requiresConnection = false,
	children,
}: ComponentPreviewProps) {
	const apiKey = useAtomValue(selectedTokenAtom);
	const [selectedConnectionId, setSelectedConnectionId] = useState<
		string | null
	>(null);
	const [selectedToolName, setSelectedToolName] = useState<string | null>(null);

	const isRenderFunction = typeof children === "function";

	// Components that don't need any token and have static children
	if (!requiresConnection && !isRenderFunction) {
		return <PreviewFrame>{children}</PreviewFrame>;
	}

	// Components with render functions need a token
	if (!apiKey) {
		return (
			<PreviewFrame>
				<div className="p-6 text-muted-foreground">
					Please select a token to view this component preview.
				</div>
			</PreviewFrame>
		);
	}

	// Components that need a connection and have render function
	if (requiresConnection && isRenderFunction) {
		return (
			<PreviewFrame>
				<div className="p-4 border-b">
					<ConnectionSelector
						token={apiKey.token}
						namespace={namespace}
						selectedConnectionId={selectedConnectionId}
						onSelect={setSelectedConnectionId}
					/>
				</div>
				<ToolComponentPreviewInner
					token={apiKey.token}
					namespace={namespace}
					connectionId={selectedConnectionId}
					selectedToolName={selectedToolName}
					setSelectedToolName={setSelectedToolName}
				>
					{children}
				</ToolComponentPreviewInner>
			</PreviewFrame>
		);
	}

	// Static children with token available (but not requiring connection)
	if (!isRenderFunction) {
		return <PreviewFrame>{children}</PreviewFrame>;
	}

	// Fallback - shouldn't normally reach here
	return (
		<PreviewFrame>
			<div className="p-6 text-muted-foreground">
				Invalid preview configuration.
			</div>
		</PreviewFrame>
	);
}

function ToolComponentPreviewInner({
	token,
	namespace,
	connectionId,
	selectedToolName,
	setSelectedToolName,
	children,
}: {
	token: string;
	namespace: string;
	connectionId: string | null;
	selectedToolName: string | null;
	setSelectedToolName: (name: string | null) => void;
	children: (props: {
		tools: Record<string, Tool>;
		handleExecute: (
			toolName: string,
			params: Record<string, unknown>,
		) => Promise<unknown>;
		connectionConfig: {
			mcpUrl: string;
			apiKey: string;
			namespace: string;
			connectionId: string;
		};
		selectedToolName: string | null;
		setSelectedToolName: (name: string | null) => void;
	}) => React.ReactNode;
}) {
	const { tools, isLoading, error, handleExecute } = useConnectionTools(
		token,
		connectionId,
		namespace,
	);

	if (!connectionId) {
		return (
			<div className="p-6 text-muted-foreground">
				Please select a connection above to view real tool data.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-6 text-muted-foreground">
				<Spinner className="h-4 w-4" />
				Loading tools from connection...
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6 text-destructive">
				Error loading tools: {error.message}
			</div>
		);
	}

	if (!tools || Object.keys(tools).length === 0) {
		return (
			<div className="p-6 text-muted-foreground">
				No tools found in this connection.
			</div>
		);
	}

	const connectionConfig = {
		mcpUrl: DEFAULT_MCP_URL,
		apiKey: token,
		namespace,
		connectionId,
	};

	return (
		<ConnectionConfigContext.Provider value={connectionConfig}>
			{children({
				tools,
				handleExecute,
				connectionConfig,
				selectedToolName,
				setSelectedToolName,
			})}
		</ConnectionConfigContext.Provider>
	);
}

// Export sub-components for direct use in MDX
export { ConnectionSelector, PreviewFrame };
