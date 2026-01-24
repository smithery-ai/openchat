"use client";

import Smithery, { AuthenticationError } from "@smithery/api";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import type { ServerListResponse } from "@smithery/api/resources/servers/servers.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { ArrowRight, CheckCircle, Link, Loader2, Lock } from "lucide-react";

interface ServerDisplayProps {
	server: ServerListResponse;
	token: string;
	namespace?: string;
}

const ServerDisplay = ({ server, token, namespace }: ServerDisplayProps) => {
	const queryClient = useQueryClient();
	const [countdown, setCountdown] = useState<number | null>(null);

	const { data: defaultNamespace } = useQuery({
		queryKey: ["defaultNamespace", token],
		queryFn: async () => {
			const client = getSmitheryClient(token);
			return await getDefaultNamespace(client);
		},
		enabled: !!token,
	});

	const activeNamespace = namespace || defaultNamespace;

	const {
		mutate: connect,
		isPending: isConnecting,
		data: connectionData,
		mutateAsync: connectAsync,
	} = useMutation({
		mutationFn: async () => {
			if (!token || !activeNamespace) {
				throw new Error("Token and namespace are required");
			}
			const client = getSmitheryClient(token);
			return await connectToServer(client, server, activeNamespace);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
		onError: (error) => {
			console.error("error connecting to server", error);
		},
	});

	// Countdown timer for auth_required state
	useEffect(() => {
		if (connectionData?.status === "auth_required" && countdown === null) {
			setCountdown(3);
		}
	}, [connectionData?.status, countdown]);

	useEffect(() => {
		if (countdown === null || countdown <= 0) return;

		const timer = setTimeout(() => {
			setCountdown(countdown - 1);
		}, 1000);

		return () => clearTimeout(timer);
	}, [countdown]);

	// Poll connection status when auth_required
	useEffect(() => {
		if (connectionData?.status !== "auth_required" || !token || !activeNamespace) {
			return;
		}

		const pollInterval = setInterval(async () => {
			try {
				const client = getSmitheryClient(token);
				const connectionId = sanitizeConnectionId(server.qualifiedName);
				const status = await checkConnectionStatus(
					client,
					connectionId,
					activeNamespace,
				);

				if (status.status === "connected") {
					// Update mutation data to trigger re-render
					await connectAsync();
					setCountdown(null);
				}
			} catch (error) {
				console.error("error checking connection status", error);
			}
		}, 2000); // Check every 2 seconds

		return () => clearInterval(pollInterval);
	}, [connectionData?.status, token, activeNamespace, server.qualifiedName, connectAsync]);

	return (
		<div className="mt-4 p-4 border rounded-md flex flex-col gap-4">
			<div className="flex items-center gap-3">
				<Avatar className="h-10 w-10 rounded-md">
					<AvatarImage src={server.iconUrl || ""} />
					<AvatarFallback className="rounded-md bg-muted">
						{server.displayName?.charAt(0) ||
							server.qualifiedName?.charAt(0) ||
							"S"}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<h3 className="font-medium truncate flex items-center">
						{server.displayName || server.qualifiedName}
						{server.verified && (
							<span
								className="text-accent-foreground text-xs ml-2"
								title="Verified"
							>
								<CheckCircle className="size-4" />
							</span>
						)}
					</h3>
					<p className="text-muted-foreground text-xs truncate">
						{server.qualifiedName}
					</p>
				</div>
			</div>

			<div className="line-clamp-2 text-muted-foreground text-sm">
				{server.description && <p>{server.description}</p>}
			</div>

			{connectionData?.status === "auth_required" && (
				<div className="flex items-start gap-3 rounded-md bg-muted p-3">
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-foreground flex items-center gap-1">
							<Lock className="size-3.5 flex-shrink-0 font-bold" /> <span className="font-medium">Authorization required</span>
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							This server requires you to authorize access. You should be automatically redirected to complete authentication.
							{" "}{countdown !== null && countdown > 0
								? `Redirecting in ${countdown}...`
								: "If not, click the link below."}
						</p>
						{connectionData.authorizationUrl && (
							<a
								href={connectionData.authorizationUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm font-bold text-blue-500 hover:text-blue-600 mt-4 flex items-center gap-1"
							>
								<span className="font-bold">Sign in to {server.displayName}</span> <ArrowRight className="size-4" />
							</a>
						)}
					</div>
				</div>
			)}

			<div className="mt-2 flex justify-between gap-4">
				<Button
					variant="secondary"
					size="sm"
					className="flex-1"
					onClick={() => {
						window.open(server.homepage, "_blank");
					}}
				>
					View Details
				</Button>

				{(() => {
					switch (connectionData?.status) {
						case "connected":
							return (
								<Button
									variant="secondary"
									size="sm"
									className="flex-1"
									disabled
								>
									<CheckCircle className="size-4" />
									Connected
								</Button>
							);
						case "auth_required":
							return (
								<Button
									variant="secondary"
									size="sm"
									className="flex-1"
									disabled
								>
									<Loader2 className="size-4 animate-spin" />
									Pending authorization...
								</Button>
							);
						default:
							return (
								<Button
									variant="default"
									size="sm"
									className="flex-1"
									onClick={() => {
										connect();
									}}
									disabled={isConnecting}
								>
									{isConnecting ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											Connecting...
										</>
									) : (
										<>
											Connect <ArrowRight className="size-4" />
										</>
									)}
								</Button>
							);
					}
				})()}
			</div>

			{connectionData?.status === "error" && (
				<p className="text-destructive text-sm mt-2">
					Error connecting to server
				</p>
			)}
		</div>
	);
};

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

// Helper function to detect if input is a URL
const isValidUrl = (str: string): boolean => {
	if (!str.trim()) return false;
	try {
		const url = new URL(str.trim());
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
};

interface ExternalURLDisplayProps {
	url: string;
	token: string;
	namespace?: string;
}

const ExternalURLDisplay = ({ url, token, namespace }: ExternalURLDisplayProps) => {
	const queryClient = useQueryClient();
	const [countdown, setCountdown] = useState<number | null>(null);

	const { data: defaultNamespace } = useQuery({
		queryKey: ["defaultNamespace", token],
		queryFn: async () => {
			const client = getSmitheryClient(token);
			return await getDefaultNamespace(client);
		},
		enabled: !!token,
	});

	const activeNamespace = namespace || defaultNamespace;

	const {
		mutate: connect,
		isPending: isConnecting,
		data: connectionData,
		mutateAsync: connectAsync,
	} = useMutation({
		mutationFn: async () => {
			if (!token || !activeNamespace) {
				throw new Error("Token and namespace are required");
			}
			const client = getSmitheryClient(token);
			const connectionId = sanitizeConnectionId(url);

			// Check for existing connection
			const existingConnection = await client.beta.connect.connections
				.get(connectionId, {
					namespace: activeNamespace,
				})
				.catch(() => null);

			if (existingConnection) {
				return await checkConnectionStatus(client, connectionId, activeNamespace);
			}

			// Create new connection
			const connection = await client.beta.connect.connections.set(connectionId, {
				namespace: activeNamespace,
				mcpUrl: url,
				name: url,
			});

			if (connection.status?.state === "auth_required") {
				return {
					status: "auth_required" as const,
					authorizationUrl: connection.status?.authorizationUrl,
				};
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
			console.error("error connecting to external URL", error);
		},
	});

	// Countdown timer for auth_required state
	useEffect(() => {
		if (connectionData?.status === "auth_required" && countdown === null) {
			setCountdown(3);
		}
	}, [connectionData?.status, countdown]);

	useEffect(() => {
		if (countdown === null || countdown <= 0) return;

		const timer = setTimeout(() => {
			setCountdown(countdown - 1);
		}, 1000);

		return () => clearTimeout(timer);
	}, [countdown]);

	// Auto-redirect when auth is required
	useEffect(() => {
		if (
			connectionData?.status === "auth_required" &&
			connectionData.authorizationUrl &&
			countdown === 0
		) {
			window.open(connectionData.authorizationUrl, "_blank");
		}
	}, [connectionData, countdown]);

	// Poll connection status when auth_required
	useEffect(() => {
		if (connectionData?.status !== "auth_required" || !token || !activeNamespace) {
			return;
		}

		const pollInterval = setInterval(async () => {
			try {
				const client = getSmitheryClient(token);
				const connectionId = sanitizeConnectionId(url);
				const status = await checkConnectionStatus(
					client,
					connectionId,
					activeNamespace,
				);

				if (status.status === "connected") {
					// Update mutation data to trigger re-render
					await connectAsync();
					setCountdown(null);
				}
			} catch (error) {
				console.error("error checking connection status", error);
			}
		}, 2000); // Check every 2 seconds

		return () => clearInterval(pollInterval);
	}, [connectionData?.status, token, activeNamespace, url, connectAsync]);

	return (
		<div className="mt-4 p-4 border rounded-md flex flex-col gap-4">
			<div className="flex items-center gap-3">
				<Avatar className="h-10 w-10 rounded-md">
					<AvatarFallback className="rounded-md bg-muted">
						<Link className="size-5" />
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<h3 className="font-medium truncate">External MCP Server</h3>
					<p className="text-muted-foreground text-xs truncate">{url}</p>
				</div>
			</div>

			{connectionData?.status === "auth_required" && (
				<div className="flex items-start gap-3 rounded-md bg-muted p-3">
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-foreground flex items-center gap-1">
							<Lock className="size-3.5 flex-shrink-0 font-bold" /> <span className="font-medium">Authorization required</span>
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							This server requires you to authorize access. You should be automatically redirected to complete authentication.
							{" "}{countdown !== null && countdown > 0
								? `Redirecting in ${countdown}...`
								: "If not, click the link below."}
						</p>
						{connectionData.authorizationUrl && (
							<a
								href={connectionData.authorizationUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm font-bold text-blue-500 hover:text-blue-600 mt-4 flex items-center gap-1"
							>
								<span className="font-bold">Authorize access</span> <ArrowRight className="size-4" />
							</a>
						)}
					</div>
				</div>
			)}

			<div className="mt-2 flex justify-end gap-4">
				{(() => {
					switch (connectionData?.status) {
						case "connected":
							return (
								<Button
									variant="secondary"
									size="sm"
									disabled
								>
									<CheckCircle className="size-4" />
									Connected
								</Button>
							);
						case "auth_required":
							return (
								<Button
									variant="secondary"
									size="sm"
									disabled
								>
									<Loader2 className="size-4 animate-spin" />
									Pending authorization...
								</Button>
							);
						default:
							return (
								<Button
									variant="default"
									size="sm"
									onClick={() => {
										connect();
									}}
									disabled={isConnecting}
								>
									{isConnecting ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											Connecting...
										</>
									) : (
										<>
											Connect <ArrowRight className="size-4" />
										</>
									)}
								</Button>
							);
					}
				})()}
			</div>

			{connectionData?.status === "error" && (
				<p className="text-destructive text-sm mt-2">
					Error connecting to server
				</p>
			)}
		</div>
	);
};

export const ServerSearch = ({ token }: { token?: string }) => {
	const [query, setQuery] = useState("");
	const [selectedServer, setSelectedServer] =
		useState<ServerListResponse | null>(null);
	const [selectedExternalUrl, setSelectedExternalUrl] = useState<string | null>(null);
	const debouncedQuery = useDebounce(query, 300);
	const isUrl = isValidUrl(query);

	const { data, isLoading } = useQuery({
		queryKey: ["servers", token, debouncedQuery],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required");
			}
			const client = getSmitheryClient(token);
			console.log("searching", debouncedQuery);
			const servers = debouncedQuery
				? await client.servers.list({ q: debouncedQuery, pageSize: 3 })
				: await client.servers.list();
			console.log(`servers for ${debouncedQuery}`, servers);
			return servers;
		},
		enabled: !!token,
	});

	const servers = data?.servers ?? [];

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (isUrl) {
				const urlToConnect = query.trim();
				setSelectedExternalUrl(urlToConnect);
				setSelectedServer(null);
				setTimeout(() => setQuery(""), 0);
			} else if (servers.length > 0) {
				setSelectedServer(servers[0]);
				setSelectedExternalUrl(null);
				setTimeout(() => setQuery(""), 0);
			}
		}
	};

	return (
		<div className="max-w-md mx-auto">
			<Combobox<ServerListResponse>
				value={selectedServer}
				onValueChange={(server) => {
					setSelectedServer(server);
					setSelectedExternalUrl(null);
				}}
				onInputValueChange={(value) => setQuery(value)}
				itemToStringLabel={(server) =>
					server.displayName || server.qualifiedName
				}
			>
				<ComboboxInput
					placeholder="Search for a server or paste MCP URL..."
					disabled={!token}
					onKeyDown={handleKeyDown}
				/>
				<ComboboxContent side="bottom" align="start">
					{isUrl ? (
						<div className="p-1">
							<button
								type="button"
								className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
								onClick={() => {
									const urlToConnect = query.trim();
									setSelectedExternalUrl(urlToConnect);
									setSelectedServer(null);
									setTimeout(() => setQuery(""), 0);
								}}
							>
								<Item size="sm" className="p-0 min-w-0">
									<ItemMedia>
										<Avatar className="h-8 w-8 rounded-md">
											<AvatarFallback className="rounded-md bg-muted">
												<Link className="size-4" />
											</AvatarFallback>
										</Avatar>
									</ItemMedia>
									<ItemContent className="min-w-0">
										<ItemTitle className="w-full truncate">
											Connect to external MCP URL
										</ItemTitle>
										<ItemDescription className="line-clamp-1 font-mono text-xs">
											{query.trim()}
										</ItemDescription>
									</ItemContent>
								</Item>
							</button>
						</div>
					) : (
						<>
							{servers.length === 0 && (
								<ComboboxEmpty>
									{isLoading ? "Loading..." : "No servers found."}
								</ComboboxEmpty>
							)}
							<ComboboxList className="max-h-[200px] overflow-y-auto">
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
						</>
					)}
				</ComboboxContent>
			</Combobox>

			{selectedServer && token && (
				<ServerDisplay server={selectedServer} token={token} />
			)}

			{selectedExternalUrl && token && (
				<ExternalURLDisplay url={selectedExternalUrl} token={token} />
			)}
		</div>
	);
};
