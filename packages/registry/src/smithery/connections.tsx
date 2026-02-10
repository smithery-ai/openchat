"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@openchat/ui/components/avatar";
import { Button } from "@openchat/ui/components/button";
import { Card, CardContent } from "@openchat/ui/components/card";
import { Separator } from "@openchat/ui/components/separator";
import { Toggle } from "@openchat/ui/components/toggle";
import { cn } from "@openchat/ui/lib/utils";
import { createConnection } from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/experimental/connect/connections.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ToolExecutionOptions } from "ai";
import { Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
	ConnectionConfigContext,
	useConnectionConfig,
} from "./connection-context";
import { WithQueryClient } from "./query-client-wrapper";
import { ServerSearch } from "./server-search";
import { useSmitheryContext } from "./smithery-provider";
import { ToolsPanel } from "./tools-panel";

// Re-export useConnectionConfig for backward compatibility
export { useConnectionConfig };

const ConnectionCardInner = ({
	connection,
	className,
	...rest
}: {
	connection: Connection;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => {
	const { client, namespace } = useSmitheryContext();
	const queryClient = useQueryClient();
	const deleteMutation = useMutation({
		mutationFn: async () => {
			await client.experimental.connect.connections.delete(
				connection.connectionId,
				{
					namespace: namespace,
				},
			);
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
						{connection.serverInfo?.title ??
							connection.serverInfo?.name ??
							connection.name}
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

export const ConnectionCard = (
	props: {
		connection: Connection;
		className?: string;
	} & React.HTMLAttributes<HTMLDivElement>,
) => (
	<WithQueryClient>
		<ConnectionCardInner {...props} />
	</WithQueryClient>
);

const ConnectionsListInner = ({
	defaultActiveConnectionId,
	onActiveConnectionIdChange,
	defaultShowSearchServers = true,
}: {
	defaultActiveConnectionId?: string;
	onActiveConnectionIdChange: (connectionId: string) => void;
	defaultShowSearchServers?: boolean;
}) => {
	const { client, token, namespace } = useSmitheryContext();
	const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
		defaultActiveConnectionId || null,
	);
	const [showSearchServers, setShowSearchServers] = useState(
		defaultShowSearchServers || false,
	);
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["connections", token, namespace],
		queryFn: async () => {
			const { connections } =
				await client.experimental.connect.connections.list(namespace);
			return { connections, namespace };
		},
		enabled: !!token && !!namespace,
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
				{showSearchServers && data && (
					<div className="px-6 pb-4">
						<ServerSearch />
					</div>
				)}
				{isLoading && <p className="text-muted-foreground px-6">Loading...</p>}
				{error && (
					<p className="text-destructive px-6">Error: {error.message}</p>
				)}
				{data?.connections && (
					<div className="overflow-auto flex-1">
						{data.connections.length === 0 && (
							<p className="text-muted-foreground px-6">No connections found</p>
						)}
						{data.connections.map((connection: Connection) => (
							<div key={`${connection.connectionId}-${data.namespace}`}>
								<Separator />
								<ConnectionCard
									connection={connection}
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

export const ConnectionsList = (props: {
	defaultActiveConnectionId?: string;
	onActiveConnectionIdChange: (connectionId: string) => void;
	defaultShowSearchServers?: boolean;
}) => (
	<WithQueryClient>
		<ConnectionsListInner {...props} />
	</WithQueryClient>
);

const ActiveConnection = ({ connectionId }: { connectionId: string }) => {
	const { client, token, namespace } = useSmitheryContext();
	const [countdown, setCountdown] = useState<number | null>(null);
	const [hasRedirected, setHasRedirected] = useState(false);

	const { data, isLoading, error } = useQuery({
		queryKey: ["connection", connectionId, token, namespace],
		queryFn: async () => {
			const data = await client.experimental.connect.connections.get(
				connectionId,
				{
					namespace,
				},
			);
			return { namespace, ...data };
		},
		enabled: !!token && !!namespace && !!connectionId,
		// Poll every 2 seconds when auth_required, stop when connected or error
		refetchInterval: (query) => {
			const state = query.state.data?.status?.state;
			if (state === "auth_required") {
				return 2000;
			}
			return false;
		},
	});

	// Start countdown when auth_required
	useEffect(() => {
		if (
			data?.status?.state === "auth_required" &&
			countdown === null &&
			!hasRedirected
		) {
			setCountdown(5);
		}
		// Reset state when connectionId changes or status is no longer auth_required
		if (data?.status?.state !== "auth_required") {
			setCountdown(null);
			setHasRedirected(false);
		}
	}, [data?.status?.state, countdown, hasRedirected]);

	// Countdown timer
	useEffect(() => {
		if (countdown === null || countdown <= 0) return;

		const timer = setTimeout(() => {
			setCountdown(countdown - 1);
		}, 1000);

		return () => clearTimeout(timer);
	}, [countdown]);

	// Auto-redirect when countdown reaches 0
	useEffect(() => {
		if (
			data?.status?.state === "auth_required" &&
			data?.status?.authorizationUrl &&
			countdown === 0 &&
			!hasRedirected
		) {
			setHasRedirected(true);
			window.open(data.status.authorizationUrl, "_blank");
		}
	}, [data?.status, countdown, hasRedirected]);

	const clientQuery = useQuery({
		queryKey: ["mcp-client", token, connectionId, namespace],
		queryFn: async () => {
			const { transport } = await createConnection({
				client,
				connectionId: connectionId,
				namespace,
			});
			const mcpClient = await createMCPClient({ transport });
			return mcpClient;
		},
		enabled: !!token && !!connectionId && data?.status?.state === "connected",
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
		enabled: !!clientQuery.data && data?.status?.state === "connected",
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
						<div className="flex items-start gap-4 mb-3">
							{data.iconUrl && (
								<Avatar className="h-12 w-12 rounded-md">
									<AvatarImage src={data.iconUrl} />
									<AvatarFallback className="rounded-md bg-muted">
										{(
											data.serverInfo?.title ??
											data.serverInfo?.name ??
											data.name
										)?.charAt(0)}
									</AvatarFallback>
								</Avatar>
							)}
							<div className="flex-1">
								<h1 className="text-xl font-semibold">
									{data.serverInfo?.title ?? data.serverInfo?.name ?? data.name}
								</h1>
								{data.serverInfo?.websiteUrl && (
									<a
										href={data.serverInfo.websiteUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-blue-500 hover:underline"
									>
										View website
									</a>
								)}
							</div>
						</div>
						{data.serverInfo?.description && (
							<p className="text-sm text-muted-foreground mb-3">
								{data.serverInfo?.description}
							</p>
						)}
						<div className="text-sm text-muted-foreground flex items-center gap-2 justify-start">
							<p>
								Connection created:{" "}
								{new Date(data.createdAt || "").toLocaleDateString()}{" "}
								{new Date(data.createdAt || "").toLocaleTimeString()}
							</p>
							<p>&middot;</p>
							<p>Connection ID: {data.connectionId}</p>
						</div>
						{data.metadata && (
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
				)}
				{data?.status && data.status.state === "auth_required" && (
					<div className="p-6">
						<p className="text-warning font-semibold">Auth required</p>
						<p className="text-xs text-muted-foreground">
							{countdown !== null && countdown > 0
								? `Redirecting in ${countdown}...`
								: "You should be automatically redirected to authenticate. If not, click the link below:"}
						</p>
						<a
							href={data.status?.authorizationUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-blue-500 hover:underline break-all"
						>
							Open authentication window
						</a>
					</div>
				)}
				{(toolsQuery.isLoading || toolsQuery.isPending) && (
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
						<div className="flex-1">
							<ToolsPanel tools={toolsQuery.data} onExecute={handleExecute} />
						</div>
					</ConnectionConfigContext.Provider>
				)}
			</div>
		</div>
	);
};

const ConnectionsInner = () => {
	const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
		null,
	);

	return (
		<div className="w-full h-full flex">
			<div className="w-full max-w-sm border-r-3 h-full overflow-auto">
				<ConnectionsListInner
					onActiveConnectionIdChange={setActiveConnectionId}
					defaultShowSearchServers={false}
				/>
			</div>
			<div className="w-full flex-1 overflow-auto">
				{activeConnectionId && (
					<ActiveConnection connectionId={activeConnectionId} />
				)}
			</div>
		</div>
	);
};

export const Connections = () => (
	<WithQueryClient>
		<ConnectionsInner />
	</WithQueryClient>
);
