"use client";

import Smithery, { AuthenticationError } from "@smithery/api";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import type { ServerListResponse } from "@smithery/api/resources/servers/servers.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDebounce } from "../../hooks/use-debounce";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "../ui/combobox";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "../ui/item";

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
	});
};

function sanitizeConnectionId(str: string): string {
	return str.replace(/[^a-zA-Z0-9_-]/g, "_");
}

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

		const connection = await client.beta.connect.connections.get(
			connectionId,
			{
				namespace: namespace,
			},
		);

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

async function connectToServer(
	client: Smithery,
	server: ServerListResponse,
	namespace: string,
): Promise<ConnectionStatus> {
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
		return await checkConnectionStatus(client, connectionId, namespace);
	}

	const connection = await client.beta.connect.connections.set(connectionId, {
		namespace: namespace,
		mcpUrl: serverUrl,
		name: server.displayName || server.qualifiedName,
	});
	console.log("connection", connection);

	if (connection.status?.state === "auth_required") {
		return {
			status: "auth_required",
			authorizationUrl: connection.status?.authorizationUrl,
		};
	}

	return {
		status: "connected",
		connection,
	};
}

export const ServerSearch = ({ token }: { token?: string }) => {
	const queryClient = useQueryClient();
	const [query, setQuery] = useState("");
	const [selectedServer, setSelectedServer] =
		useState<ServerListResponse | null>(null);
	const debouncedQuery = useDebounce(query, 300);

	const { data: namespaceData } = useQuery({
		queryKey: ["namespace", token],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required");
			}
			const client = getSmitheryClient(token);
			return await getDefaultNamespace(client);
		},
		enabled: !!token,
	});

	const { data, isLoading } = useQuery({
		queryKey: ["servers", debouncedQuery],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required");
			}
			const client = getSmitheryClient(token);
			console.log("searching", debouncedQuery);
			const servers = await client.servers.list({ q: debouncedQuery });
			console.log(`servers for ${debouncedQuery}`, servers);
			return servers;
		},
		enabled: debouncedQuery.length > 0 && !!token,
	});

	const {
		mutate: connect,
		isPending: isConnecting,
		data: connectionData,
	} = useMutation({
		mutationFn: async (server: ServerListResponse) => {
			if (!token || !namespaceData) {
				throw new Error("Token and namespace are required");
			}
			const client = getSmitheryClient(token);
			return await connectToServer(client, server, namespaceData);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
		onError: (error) => {
			console.error("error connecting to server", error);
		},
	});

	const servers = data?.servers ?? [];

	return (
		<div className="max-w-md mx-auto">
			<Combobox<ServerListResponse>
				value={selectedServer}
				onValueChange={(server) => {
					setSelectedServer(server);
					if (server) {
						connect(server);
					}
				}}
				onInputValueChange={(value) => setQuery(value)}
				itemToStringLabel={(server) =>
					server.displayName || server.qualifiedName
				}
			>
				<ComboboxInput
					placeholder="Search for a server..."
					disabled={!token}
				/>
				<ComboboxContent>
					{servers.length === 0 && <ComboboxEmpty>
						{isLoading ? "Loading..." : "No servers found."}
					</ComboboxEmpty>}
					<ComboboxList>
						{servers.map((server) => (
							<ComboboxItem key={server.qualifiedName} value={server}>
								<Item size="sm" className="p-0 min-w-0">
									<ItemMedia>
										<Avatar className="h-8 w-8 rounded-md">
											<AvatarImage src={server.iconUrl || ""} />
											<AvatarFallback className="rounded-md bg-muted text-xs">
												{server.displayName?.charAt(0) ||
													server.qualifiedName?.charAt(0) ||
													"S"}
											</AvatarFallback>
										</Avatar>
									</ItemMedia>
									<ItemContent className="min-w-0">
										<ItemTitle className="w-full truncate">
											{server.displayName || server.qualifiedName}
										</ItemTitle>
										<ItemDescription className="line-clamp-1">
											{server.description || server.qualifiedName}
										</ItemDescription>
									</ItemContent>
								</Item>
							</ComboboxItem>
						))}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>

			{selectedServer && (
				<div className="mt-4 p-4 border rounded-md">
					<div className="flex items-center gap-3">
						<Avatar className="h-10 w-10 rounded-md">
							<AvatarImage src={selectedServer.iconUrl || ""} />
							<AvatarFallback className="rounded-md bg-muted">
								{selectedServer.displayName?.charAt(0) ||
									selectedServer.qualifiedName?.charAt(0) ||
									"S"}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<h3 className="font-medium truncate">
								{selectedServer.displayName || selectedServer.qualifiedName}
							</h3>
							<p className="text-muted-foreground text-xs truncate">
								{selectedServer.qualifiedName}
							</p>
						</div>
					</div>

					{isConnecting && (
						<p className="text-muted-foreground text-sm mt-2">Connecting...</p>
					)}

					{connectionData?.status === "connected" && (
						<p className="text-green-600 text-sm mt-2">Connected</p>
					)}

					{connectionData?.status === "auth_required" &&
						connectionData?.authorizationUrl && (
							<div className="mt-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										window.open(connectionData.authorizationUrl, "_blank");
									}}
								>
									Authorize
								</Button>
							</div>
						)}

					{connectionData?.status === "error" && (
						<p className="text-destructive text-sm mt-2">
							Error connecting to server
						</p>
					)}
				</div>
			)}
		</div>
	);
};
