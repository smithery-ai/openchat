"use client";

import Smithery, { AuthenticationError } from "@smithery/api";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as LinkIcon, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";

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
	const [testConnectionData, setTestConnectionData] =
		useState<ConnectionStatus | null>(null);

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

	const testMutation = useMutation({
		mutationFn: async () => {
			const client = getSmitheryClient(token);
			return await checkConnectionStatus(
				client,
				connection.connectionId,
				namespace,
			);
		},
		onSuccess: (data) => {
			setTestConnectionData(data);
		},
		onError: (error) => {
			console.error("error testing connection", error);
			setTestConnectionData({
				status: "error",
				error,
			});
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
					<h3 className="font-medium truncate">{connection.name}</h3>
					<p className="text-muted-foreground text-xs truncate">
						{connection.connectionId}
					</p>
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
					{testConnectionData?.status === "connected" && (
						<p className="text-green-600 text-xs">Connected</p>
					)}
					{testConnectionData?.status === "auth_required" &&
						testConnectionData?.authorizationUrl && (
							<div className="mt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										window.open(testConnectionData.authorizationUrl, "_blank");
									}}
								>
									Authorize
								</Button>
							</div>
						)}
					{testConnectionData?.status === "error" && (
						<p className="text-destructive text-xs">
							Error:{" "}
							{testConnectionData.error instanceof Error
								? testConnectionData.error.message
								: "Unknown error"}
						</p>
					)}
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => testMutation.mutate()}
					disabled={testMutation.isPending}
					title="Test connection"
				>
					<LinkIcon className="h-4 w-4" />
				</Button>
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
}: {
	token: string;
	namespace?: string;
	defaultActiveConnectionId?: string;
	onActiveConnectionIdChange: (connectionId: string) => void;
}) => {
	const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
		defaultActiveConnectionId || null,
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
		<div className="max-w-md">
			<div className="flex items-center justify-between px-6 py-3">
				<h2 className="text-lg font-semibold">Connections</h2>
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
			{isLoading && <p className="text-muted-foreground">Loading...</p>}
			{error && <p className="text-destructive">Error: {error.message}</p>}
			{data && (
				<div className="overflow-auto max-h-[500px]">
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
	);
};

const ActiveConnection = ({ connectionId }: { connectionId: string }) => {
	return (
		<div className="w-full h-full">
			<h2 className="text-lg font-semibold">Active Connection: {connectionId}</h2>
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
			<div className="w-full max-w-sm border-r-3">
				<ConnectionsList
					token={token}
					namespace={namespace}
					onActiveConnectionIdChange={setActiveConnectionId}
				/>
			</div>
			<div className="w-full flex-1 h-full">
				<ActiveConnection connectionId={activeConnectionId || ""} />
			</div>
		</div>
	);
};
