"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import { SmitheryTransport } from "@smithery/api/mcp";
import { useQuery } from "@tanstack/react-query";
import type { ToolExecutionOptions } from "ai";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	ConnectionConfigContext,
	useConnectionConfig,
} from "@/registry/new-york/smithery/connection-context";
import {
	getDefaultNamespace,
	getSmitheryClient,
} from "@/registry/new-york/smithery/smithery-utils";
import { ToolsPanel } from "@/registry/new-york/smithery/tools-panel";

// Re-export useConnectionConfig for backward compatibility
export { useConnectionConfig };

export const ActiveConnection = ({
	token,
	namespace,
	connectionId,
}: {
	token: string;
	namespace?: string;
	connectionId: string;
}) => {
	const [countdown, setCountdown] = useState<number | null>(null);
	const [hasRedirected, setHasRedirected] = useState(false);

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
		enabled: !!connectionId && data?.status?.state === "connected",
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
