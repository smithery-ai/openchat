"use client";

import Smithery, { AuthenticationError } from "@smithery/api";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as LinkIcon, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";
import { ServerSearch } from "./server-search";
import { Toggle } from "../ui/toggle";

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

type ConnectionStatus =
	| { status: "connected"; connection: Connection }
	| { status: "auth_required"; authorizationUrl?: string }
	| { status: "error"; error: unknown };

async function checkConnectionStatus(
	client: Smithery,
	connectionId: string,
	namespace: string,
): Promise<ConnectionStatus> {
	try {
		const jsonRpcResponse = await client.beta.connect.rpc.call(connectionId, {
			namespace,
			jsonrpc: "2.0",
			method: "tools/list",
		});
		console.log("jsonRpcResponse", jsonRpcResponse);

		const connection = await client.beta.connect.connections.get(connectionId, {
			namespace: namespace,
		});

		return {
			status: "connected",
			connection,
		};
	} catch (error) {
		if (error instanceof AuthenticationError) {
			const errorData = error.error as unknown as {
				error?: { data?: { authorizationUrl?: string } };
				data?: { authorizationUrl?: string };
			};
			const authorizationUrl =
				errorData?.error?.data?.authorizationUrl ||
				errorData?.data?.authorizationUrl;
			return {
				status: "auth_required",
				authorizationUrl,
			};
		}
		console.error("error connecting to server", error);
		return {
			status: "error",
			error,
		};
	}
}

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
								{"•".repeat(
									Math.min(connection.connectionId.length - 10, 4)
								)}
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
			{isLoading && <p className="text-muted-foreground">Loading...</p>}
			{error && <p className="text-destructive">Error: {error.message}</p>}
			{data && (
				<div className="overflow-auto flex-1">
					{data.connections.length === 0 && (
						<p className="text-muted-foreground">No connections found</p>
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
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["connection", connectionId],
		queryFn: async () => {
			const client = getSmitheryClient(token);
			const namespaceToUse = namespace || (await getDefaultNamespace(client));
			const data = await client.beta.connect.connections.get(connectionId, {
				namespace: namespaceToUse,
			});
			return { namespace: namespaceToUse, ...data };
		},
	});
	return (
		<div className="w-full h-full">
			{isLoading && <p className="text-muted-foreground">Loading...</p>}
			{error && <p className="text-destructive">Error: {error.message}</p>}
			{data && (
				<div className="w-full h-full">
					<p className="text-muted-foreground">Connection: {data.name}</p>
					<p className="text-muted-foreground">
						Connection ID: {data.connectionId}
					</p>
					<p className="text-muted-foreground">Namespace: {namespace}</p>
					<p className="text-muted-foreground">
						Created At: {new Date(data.createdAt || "").toLocaleDateString()}{" "}
						{new Date(data.createdAt || "").toLocaleTimeString()}
					</p>
					<p className="text-muted-foreground">
						Metadata: {data.metadata && JSON.stringify(data.metadata)}
					</p>
				</div>
			)}
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
			<div className="w-full flex-1">
				<ActiveConnection
					token={token}
					namespace={namespace}
					connectionId={activeConnectionId || ""}
				/>
			</div>
		</div>
	);
};
