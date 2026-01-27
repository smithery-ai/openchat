"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import Smithery from "@smithery/api";
import { SmitheryTransport } from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ToolExecutionOptions } from "ai";
import { Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { ServerSearch } from "@/registry/new-york/smithery/server-search";
import { ToolsPanel } from "@/registry/new-york/smithery/tools-panel";
import {
	ConnectionConfigContext,
	useConnectionConfig,
} from "@/registry/new-york/smithery/connection-context";

// Re-export useConnectionConfig for backward compatibility
export { useConnectionConfig };

async function getDefaultNamespace(client: Smithery) {
	const namespaces = await client.namespaces.list();
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return namespaces.namespaces[0].name;
}

const getSmitheryClient = (token: string) => {
	return new Smithery({
		apiKey: token,
		baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	});
};

export const ConnectionCard = ({
	connection,
	token,
	namespace,
	className,
	...rest
}: {
	connection: Connection;
	token: string;
	namespace: string;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
	const queryClient = useQueryClient();
	const deleteMutation = useMutation({
		mutationFn: async () => {
			const client = getSmitheryClient(token);
			await client.beta.connect.connections.delete(connection.connectionId, {
				namespace: namespace,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
	});

	return (
		<Card className={cn("border-none shadow-none", className || "")} {...rest}>
			<CardContent className="flex items-center gap-4">
				<Avatar className="h-10 w-10 rounded-md">
					<AvatarImage src={connection.iconUrl || ""} />
					<AvatarFallback className="rounded-md bg-muted">
						{connection.name.charAt(0)}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<h3 className="font-medium truncate flex items-center gap-2">
						{connection.name}
						{connection.connectionId && (
							<span className="ml-2 text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
								{"•".repeat(Math.min(connection.connectionId.length - 10, 4))}
								{connection.connectionId.slice(-10)}
							</span>
						)}
					</h3>
					<p className="text-muted-foreground text-xs truncate">
						{connection.mcpUrl}
					</p>
					<p className="text-muted-foreground text-xs truncate">
						{new Date(connection.createdAt || "").toLocaleDateString()}{" "}
						{new Date(connection.createdAt || "").toLocaleTimeString()}
					</p>
					<p className="text-muted-foreground text-xs truncate">
						{connection.metadata && JSON.stringify(connection.metadata)}
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => deleteMutation.mutate()}
					disabled={deleteMutation.isPending}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</CardContent>
		</Card>
	);
};

export const ConnectionsList = ({
	token,
	namespace,
	defaultActiveConnectionId,
	onActiveConnectionIdChange,
	defaultShowSearchServers = true,
}: {
	token: string;
	namespace?: string;
	defaultActiveConnectionId?: string;
	onActiveConnectionIdChange: (connectionId: string) => void;
	defaultShowSearchServers?: boolean;
}) => {
	const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
		defaultActiveConnectionId || null,
	);
	const [showSearchServers, setShowSearchServers] = useState(
		defaultShowSearchServers || false,
	);
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["connections", token],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required");
			}
			const client = getSmitheryClient(token);
			const namespaceToUse = namespace || (await getDefaultNamespace(client));
			const { connections } =
				await client.beta.connect.connections.list(namespaceToUse);
			return { connections, namespace: namespaceToUse };
		},
		enabled: !!token,
	});

	useEffect(() => {
		if (data?.connections && !defaultActiveConnectionId) {
			setActiveConnectionId(data?.connections[0]?.connectionId || null);
		}
	}, [data?.connections, defaultActiveConnectionId]);

	useEffect(() => {
		if (activeConnectionId) {
			onActiveConnectionIdChange(activeConnectionId);
		}
	}, [activeConnectionId, onActiveConnectionIdChange]);

	return (
		<div className="max-w-md flex flex-col h-full">
			<div className="flex items-center justify-between px-6 py-3">
				<h2 className="text-lg font-semibold">Connections</h2>
				<div className="flex items-center gap-2">
					<Toggle
						defaultPressed={defaultShowSearchServers}
						onPressedChange={setShowSearchServers}
					>
						{showSearchServers ? (
							<X className="h-4 w-4" />
						) : (
							<Plus className="h-4 w-4" />
						)}
					</Toggle>
					<Button
						variant="outline"
						size="icon"
						onClick={() => refetch()}
						disabled={isFetching}
						title="Refresh connections"
					>
						<RefreshCw
							className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
						/>
					</Button>
				</div>
			</div>
			<div className="flex-1 flex flex-col">
				{showSearchServers && (
					<div className="px-6 pb-4">
						<ServerSearch token={token} namespace={data?.namespace} />
					</div>
				)}
				{isLoading && <p className="text-muted-foreground px-6">Loading...</p>}
				{error && (
					<p className="text-destructive px-6">Error: {error.message}</p>
				)}
				{data && (
					<div className="overflow-auto flex-1">
						{data.connections.length === 0 && (
							<p className="text-muted-foreground px-6">No connections found</p>
						)}
						{data.connections.map((connection: Connection) => (
							<div key={`${connection.connectionId}-${data.namespace}`}>
								<Separator />
								<ConnectionCard
									connection={connection}
									token={token}
									namespace={data.namespace}
									className={cn(
										"rounded-none",
										activeConnectionId === connection.connectionId
											? "bg-muted"
											: "hover:bg-muted/50 hover:cursor-pointer",
									)}
									onClick={() => setActiveConnectionId(connection.connectionId)}
								/>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

const ActiveConnection = ({
	token,
	namespace,
	connectionId,
}: {
	token: string;
	namespace?: string;
	connectionId: string;
}) => {
	const { data, isLoading, error } = useQuery({
		queryKey: ["connection", connectionId, token, namespace],
		queryFn: async () => {
			const client = getSmitheryClient(token);
			const namespaceToUse = namespace || (await getDefaultNamespace(client));
			const data = await client.beta.connect.connections.get(connectionId, {
				namespace: namespaceToUse,
			});
			return { namespace: namespaceToUse, ...data };
		},
	});

	const clientQuery = useQuery({
		queryKey: ["mcp-client", token, connectionId, namespace],
		queryFn: async () => {
			const namespaceToUse =
				namespace || (await getDefaultNamespace(getSmitheryClient(token)));
			const transport = new SmitheryTransport({
				client: getSmitheryClient(token),
				connectionId: connectionId,
				namespace: namespaceToUse,
			});
			const mcpClient = await createMCPClient({ transport });
			return mcpClient;
		},
		enabled: !!connectionId,
	});

	const toolsQuery = useQuery({
		queryKey: ["tools", connectionId, token, namespace],
		queryFn: async () => {
			if (!clientQuery.data) {
				throw new Error("Client not available");
			}
			const client = clientQuery.data;
			return await client.tools();
		},
		enabled: !!clientQuery.data,
	});
	const handleExecute = async (
		toolName: string,
		params: Record<string, unknown>,
	) => {
		if (!toolsQuery.data) {
			throw new Error("Tools not available");
		}
		const tool = toolsQuery.data[toolName];
		if (!tool) {
			throw new Error(`Tool ${toolName} not found`);
		}
		// The execute method from AI SDK tools expects (params, options)
		// We're executing tools directly, so provide minimal required options
		const options: ToolExecutionOptions = {
			toolCallId: `manual-${Date.now()}`,
			messages: [],
		};
		return await tool.execute(params, options);
	};

	return (
		<div className="w-full h-full flex flex-col overflow-auto">
			<div className="w-full h-full flex flex-col">
				{isLoading && (
					<div className="p-6">
						<p className="text-muted-foreground">Loading connection...</p>
					</div>
				)}
				{error && (
					<div className="p-6">
						<p className="text-destructive">Error: {error.message}</p>
					</div>
				)}
				{data && (
					<div className="border-b p-6">
						<h1 className="text-xl font-semibold mb-3">{data.name}</h1>
						<div className="space-y-1 text-sm text-muted-foreground">
							<p>ID: {data.connectionId}</p>
							<p>
								Created: {new Date(data.createdAt || "").toLocaleDateString()}{" "}
								{new Date(data.createdAt || "").toLocaleTimeString()}
							</p>
							{data.metadata && (
								<p>Metadata: {JSON.stringify(data.metadata)}</p>
							)}
						</div>
					</div>
				)}
				{toolsQuery.isLoading && (
					<div className="p-6">
						<p className="text-muted-foreground">Loading tools...</p>
					</div>
				)}
				{toolsQuery.error && (
					<div className="p-6">
						<p className="text-destructive">
							Error: {toolsQuery.error.message}
						</p>
					</div>
				)}
				{toolsQuery.data && data && (
					<ConnectionConfigContext.Provider
						value={{
							mcpUrl: data.mcpUrl || "",
							apiKey: token,
							namespace: data.namespace,
							connectionId: connectionId,
						}}
					>
						<div className="flex-1 overflow-hidden">
							<ToolsPanel tools={toolsQuery.data} onExecute={handleExecute} />
						</div>
					</ConnectionConfigContext.Provider>
				)}
			</div>
		</div>
	);
};

export const Connections = ({
	token,
	namespace,
}: {
	token: string;
	namespace?: string;
}) => {
	const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
		null,
	);

	return (
		<div className="w-full h-full flex">
			<div className="w-full max-w-sm border-r-3 h-full overflow-auto">
				<ConnectionsList
					token={token}
					namespace={namespace}
					onActiveConnectionIdChange={setActiveConnectionId}
					defaultShowSearchServers={false}
				/>
			</div>
			<div className="w-full flex-1 overflow-auto">
				<ActiveConnection
					token={token}
					namespace={namespace}
					connectionId={activeConnectionId || ""}
				/>
			</div>
		</div>
	);
};
