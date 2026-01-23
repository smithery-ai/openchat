"use client";

import Smithery, { AuthenticationError } from "@smithery/api";
import type { ServerListResponse } from "@smithery/api/resources/servers/servers.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounce } from "../../hooks/use-debounce";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";

async function getDefaultNamespace(client: Smithery) {
	const namespaces = await client.namespaces.list();
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return namespaces.namespaces[0].name;
}

function sanitizeConnectionId(str: string): string {
	return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

type ConnectionStatus =
	| { status: "connected"; connection: unknown }
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

async function pollConnectionStatus(
	client: Smithery,
	connectionId: string,
	namespace: string,
	onStatusChange: (status: ConnectionStatus) => void,
	pollInterval = 3000,
): Promise<() => void> {
	const intervalId = setInterval(async () => {
		const status = await checkConnectionStatus(client, connectionId, namespace);
		if (status.status !== "auth_required") {
			clearInterval(intervalId);
			onStatusChange(status);
		}
	}, pollInterval);

	return () => clearInterval(intervalId);
}

export const ServerCard = ({
	server,
	token,
	namespace,
}: {
	server: ServerListResponse;
	token: string;
	namespace: string;
}) => {
	const queryClient = useQueryClient();
	const [cleanupPoller, setCleanupPoller] = useState<(() => void) | null>(null);
	const [localConnectionData, setLocalConnectionData] =
		useState<ConnectionStatus | null>(null);

	const {
		mutate: connect,
		isPending: isConnecting,
		error: connectionError,
		data: connectionData,
	} = useMutation({
		mutationFn: async () => {
			const client = new Smithery({
				apiKey: token,
			});

			const connectionId = sanitizeConnectionId(server.qualifiedName);
			const serverUrl =
				server.qualifiedName.startsWith("http://") ||
				server.qualifiedName.startsWith("https://")
					? server.qualifiedName
					: `https://server.smithery.ai/${server.qualifiedName}/mcp`;

			// Avoid re-creating an existing connection
			const existingConnection = await client.beta.connect.connections
				.get(connectionId, {
					namespace: namespace,
				})
				.catch(() => {
					return null;
				});
			console.log("existingConnection", existingConnection);

			if (existingConnection) {
				const status = await checkConnectionStatus(
					client,
					connectionId,
					namespace,
				);

				if (status.status === "auth_required") {
					// Start polling for auth status change
					const cleanup = await pollConnectionStatus(
						client,
						connectionId,
						namespace,
						(newStatus) => {
							setLocalConnectionData(newStatus);
							if (newStatus.status === "connected") {
								queryClient.invalidateQueries({ queryKey: ["connections"] });
							}
						},
					);
					setCleanupPoller(() => cleanup);
				}

				return status;
			}

			const connection = await client.beta.connect.connections.set(
				connectionId,
				{
					namespace: namespace,
					mcpUrl: serverUrl,
					name: server.displayName || server.qualifiedName,
				},
			);
			console.log("connection", connection);

			if (connection.status?.state === "auth_required") {
				const authStatus = {
					status: "auth_required" as const,
					authorizationUrl: connection.status?.authorizationUrl,
				};

				// Start polling for auth status change
				const cleanup = await pollConnectionStatus(
					client,
					connectionId,
					namespace,
					(newStatus) => {
						setLocalConnectionData(newStatus);
						if (newStatus.status === "connected") {
							queryClient.invalidateQueries({ queryKey: ["connections"] });
						}
					},
				);
				setCleanupPoller(() => cleanup);

				return authStatus;
			}

			return {
				status: "connected" as const,
				connection,
			};
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
		onError: (error) => {
			console.error("error connecting to server", error);
		},
	});

	// Cleanup poller on unmount
	useEffect(() => {
		return () => {
			if (cleanupPoller) {
				cleanupPoller();
			}
		};
	}, [cleanupPoller]);

	// Use local connection data if available (updated by polling), otherwise use mutation data
	const displayConnectionData = localConnectionData || connectionData;

	return (
		<Card className="border-none shadow-none">
			<CardContent className="flex items-center gap-4">
				<Avatar className="h-10 w-10 rounded-md">
					<AvatarImage src={server.iconUrl || ""} />
					<AvatarFallback className="rounded-md bg-muted">
						{server.displayName?.charAt(0) ||
							server.qualifiedName?.charAt(0) ||
							"S"}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<h3 className="font-medium truncate">
						{server.displayName || server.qualifiedName}
					</h3>
					<p className="text-muted-foreground text-xs truncate">
						{server.qualifiedName}
					</p>
					{server.description && (
						<p className="text-muted-foreground text-xs truncate">
							{server.description}
						</p>
					)}
					{connectionError && (
						<p className="text-destructive text-xs">
							Error: {connectionError.message}
						</p>
					)}
					{displayConnectionData?.status === "auth_required" &&
						displayConnectionData?.authorizationUrl && (
							<div className="mt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										window.open(
											displayConnectionData.authorizationUrl,
											"_blank",
										);
									}}
								>
									Authorize
								</Button>
							</div>
						)}
					{displayConnectionData?.status === "connected" && (
						<p className="text-green-600 text-xs">Connected</p>
					)}
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => connect()}
					disabled={isConnecting}
				>
					<LinkIcon className="h-4 w-4" />
				</Button>
			</CardContent>
		</Card>
	);
};

export const ServerSearch = ({
	token,
	initialQuery,
}: {
	token?: string;
	initialQuery?: string;
}) => {
	const [query, setQuery] = useState(initialQuery || "");
	const debouncedQuery = useDebounce(query, 300);

	// Update query when initialQuery changes
	useEffect(() => {
		if (initialQuery !== undefined) {
			setQuery(initialQuery);
		}
	}, [initialQuery]);

	const { data: namespaceData } = useQuery({
		queryKey: ["namespace", token],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required");
			}
			const client = new Smithery({
				apiKey: token,
			});
			return await getDefaultNamespace(client);
		},
		enabled: !!token,
	});

	const { data, isLoading, error } = useQuery({
		queryKey: ["servers", debouncedQuery],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required");
			}
			const client = new Smithery({
				apiKey: token,
			});
			console.log("searching", debouncedQuery);
			const servers = await client.servers.list({ q: debouncedQuery });
			console.log(`servers for ${debouncedQuery}`, servers);
			return servers;
		},
		enabled: debouncedQuery.length > 0 && !!token,
	});

	return (
		<div className={initialQuery ? "" : "max-w-md mx-auto"}>
			{!initialQuery && (
				<Input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search for a server"
				/>
			)}
			{isLoading && <p className="text-muted-foreground">Loading...</p>}
			{error && <p className="text-destructive">Error: {error.message}</p>}
			{data && namespaceData && token && (
				<div
					className={
						initialQuery ? "space-y-2" : "space-y-2 overflow-auto max-h-[500px]"
					}
				>
					{data.servers.map((server: ServerListResponse) => (
						<div key={server.qualifiedName}>
							<ServerCard
								server={server}
								token={token}
								namespace={namespaceData}
							/>
							<Separator />
						</div>
					))}
				</div>
			)}
		</div>
	);
};
