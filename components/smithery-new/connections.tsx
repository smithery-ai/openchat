"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import Smithery from "@smithery/api";
import { SmitheryTransport } from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ToolExecutionOptions } from "ai";
import { ExternalLink, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

// Context for connection config - consumed by ToolDetailDialog for code generation
interface ConnectionConfig {
	mcpUrl: string;
	apiKey: string;
	namespace: string;
	connectionId: string;
}

const ConnectionConfigContext = createContext<ConnectionConfig | null>(null);

export function useConnectionConfig() {
	return useContext(ConnectionConfigContext);
}

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import { Toggle } from "../ui/toggle";
import { ServerSearch } from "./server-search";
import { ToolsPanel } from "./tools-panel";

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
		// Poll every 2 seconds while status is not "connected" (e.g., during OAuth flow)
		refetchInterval: (query) => {
			const status = query.state.data?.status?.state;
			return status && status !== "connected" ? 2000 : false;
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
						<div className="flex items-start gap-4">
							<Avatar className="h-14 w-14 rounded-lg">
								<AvatarImage src={data.iconUrl || ""} />
								<AvatarFallback className="rounded-lg bg-muted text-lg">
									{data.name?.charAt(0)}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-3 mb-1">
									<h1 className="text-xl font-semibold">
										{data.serverInfo?.title ??
											data.serverInfo?.name ??
											data.name}
									</h1>
									<Badge
										variant={
											data.status?.state === "connected"
												? "default"
												: "secondary"
										}
										className={cn(
											"text-xs",
											data.status?.state === "connected" &&
												"bg-green-500/15 text-green-600 hover:bg-green-500/20",
										)}
									>
										{data.status?.state || "unknown"}
									</Badge>
									{data.serverInfo?.version && (
										<span className="text-xs text-muted-foreground">
											v{data.serverInfo.version}
										</span>
									)}
								</div>
								{data.serverInfo?.description && (
									<p className="text-sm text-muted-foreground mb-3 line-clamp-2">
										{data.serverInfo.description}
									</p>
								)}
								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<span className="text-xs text-muted-foreground">
										Connection ID: {data.connectionId}
									</span>
									<span>
										Created{" "}
										{new Date(data.createdAt || "").toLocaleDateString()}
									</span>
									{data.serverInfo?.websiteUrl && (
										<a
											href={data.serverInfo.websiteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1 text-primary hover:underline"
										>
											<ExternalLink className="h-3 w-3" />
											View on Smithery
										</a>
									)}
								</div>
								{data.metadata && Object.keys(data.metadata).length > 0 && (
									<div className="mt-3 p-3 bg-muted/50 rounded-md">
										<p className="text-xs font-medium text-muted-foreground mb-2">
											Metadata
										</p>
										<pre className="text-xs text-muted-foreground overflow-auto">
											{JSON.stringify(data.metadata, null, 2)}
										</pre>
									</div>
								)}
							</div>
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
