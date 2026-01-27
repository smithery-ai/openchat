"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import Smithery from "@smithery/api";
import {
	createConnection,
	SmitheryAuthorizationError,
} from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import type { ServerListResponse } from "@smithery/api/resources/servers/servers.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowRight,
	CheckCircle,
	Link,
	Loader2,
	Lock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { listNamespaces } from "@/components/smithery/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { useDebounce } from "@/hooks/use-debounce";
import { WithQueryClient } from "@/registry/new-york/smithery/query-client-wrapper";

interface AuthRequiredBannerProps {
	serverName: string;
	authorizationUrl?: string;
	countdown: number | null;
}

const AuthRequiredBanner = ({
	serverName,
	authorizationUrl,
	countdown,
}: AuthRequiredBannerProps) => (
	<div className="flex items-start gap-3 rounded-md bg-muted p-3">
		<div className="flex-1 min-w-0">
			<p className="text-sm font-medium text-foreground flex items-center gap-1">
				<Lock className="size-3.5 flex-shrink-0 font-bold" />{" "}
				<span className="font-medium">Authorization required</span>
			</p>
			<p className="text-xs text-muted-foreground mt-1">
				This server requires you to authorize access. You should be
				automatically redirected to complete authentication.{" "}
				{countdown !== null && countdown > 0
					? `Redirecting in ${countdown}...`
					: "If not, click the link below."}
			</p>
			{authorizationUrl && (
				<a
					href={authorizationUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="text-sm font-bold text-blue-500 hover:text-blue-600 mt-4 flex items-center gap-1"
				>
					<span className="font-bold">Sign in to {serverName}</span>{" "}
					<ArrowRight className="size-4" />
				</a>
			)}
		</div>
	</div>
);

interface ExistingConnectionWarningBannerProps {
	serverName: string;
	onUseExisting: () => void;
	onCreateNew: () => void;
	isConnecting: boolean;
}

const ExistingConnectionWarningBanner = ({
	serverName,
	onUseExisting,
	onCreateNew,
	isConnecting,
}: ExistingConnectionWarningBannerProps) => (
	<div className="flex flex-col gap-3 rounded-md bg-muted p-3">
		<div className="flex items-start gap-3">
			<AlertTriangle className="size-4 flex-shrink-0 text-amber-500 mt-0.5" />
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground">
					Connection already exists
				</p>
				<p className="text-xs text-muted-foreground mt-1">
					A connection to {serverName} already exists. Would you like to use the
					existing connection or create a new one?
				</p>
			</div>
		</div>
		<div className="flex gap-2">
			<Button
				variant="secondary"
				size="sm"
				className="flex-1"
				onClick={onUseExisting}
				disabled={isConnecting}
			>
				{isConnecting ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					"Use existing"
				)}
			</Button>
			<Button
				variant="default"
				size="sm"
				className="flex-1"
				onClick={onCreateNew}
				disabled={isConnecting}
			>
				{isConnecting ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					"Create new"
				)}
			</Button>
		</div>
	</div>
);

interface ConnectionButtonProps {
	connectionStatus?:
		| "connected"
		| "auth_required"
		| "existing_connection_warning"
		| "error";
	isConnecting: boolean;
	onConnect: () => void;
}

const ConnectionButton = ({
	connectionStatus,
	isConnecting,
	onConnect,
}: ConnectionButtonProps) => {
	switch (connectionStatus) {
		case "connected":
			return (
				<Button variant="secondary" size="sm" className="flex-1" disabled>
					<CheckCircle className="size-4" />
					Connected
				</Button>
			);
		case "auth_required":
			return (
				<Button variant="secondary" size="sm" className="flex-1" disabled>
					<Loader2 className="size-4 animate-spin" />
					Waiting...
				</Button>
			);
		case "existing_connection_warning":
			// Buttons are rendered separately in ExistingConnectionWarningBanner
			return null;
		default:
			return (
				<Button
					variant="default"
					size="sm"
					className="flex-1"
					onClick={onConnect}
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
};

type OnExistingConnectionMode = "warn" | "error" | "use" | "create-new";

interface ServerDisplayProps {
	server: ServerListResponse;
	token: string;
	namespace?: string;
	onExistingConnection: OnExistingConnectionMode;
	onServerConnect?: (connection: Connection) => void;
}

const ServerDisplay = ({
	server,
	token,
	namespace,
	onExistingConnection,
	onServerConnect,
}: ServerDisplayProps) => {
	const queryClient = useQueryClient();
	const [countdown, setCountdown] = useState<number | null>(null);

	const { data: activeNamespace } = useQuery({
		queryKey: ["defaultNamespace", token],
		queryFn: async () => {
			if (namespace) {
				return namespace;
			}
			return await getDefaultNamespace();
		},
		enabled: !!token,
	});

	const serverUrl =
		server.qualifiedName.startsWith("http://") ||
		server.qualifiedName.startsWith("https://")
			? server.qualifiedName
			: `https://server.smithery.ai/${server.qualifiedName}/mcp`;
	const serverName = server.displayName || server.qualifiedName;

	const {
		mutate: connect,
		isPending: isConnecting,
		data: connectionData,
		mutateAsync: connectAsync,
	} = useMutation({
		mutationFn: async (
			overrideMode?: "use" | "create-new",
		): Promise<ConnectionStatus> => {
			if (!token || !activeNamespace) {
				throw new Error("Token and namespace are required");
			}
			const client = getSmitheryClient(token);
			return await getOrCreateConnection(
				client,
				activeNamespace,
				serverUrl,
				serverName,
				overrideMode ?? onExistingConnection,
			);
		},
		onSuccess: (data) => {
			if (data.status === "connected" && onServerConnect) {
				onServerConnect(data.connection);
			}
			queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
		onError: (error) => {
			console.error(
				"error connecting to server",
				`server: ${server.qualifiedName}, namespace: ${activeNamespace}`,
				error,
			);
		},
	});

	const handleUseExisting = () => {
		connect("use");
	};

	const handleCreateNew = () => {
		connect("create-new");
	};

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
	const authConnectionId =
		connectionData?.status === "auth_required"
			? connectionData.connectionId
			: null;

	useEffect(() => {
		if (!authConnectionId || !token || !activeNamespace) {
			return;
		}

		const pollInterval = setInterval(async () => {
			try {
				const client = getSmitheryClient(token);
				const status = await checkConnectionStatus(
					client,
					authConnectionId,
					activeNamespace,
				);

				if (status.status === "connected") {
					// Update mutation data to trigger re-render
					// Use "use" mode to reuse the existing connection we're polling
					await connectAsync("use");
					setCountdown(null);
				}
			} catch (error) {
				console.error("error checking connection status", error);
			}
		}, 2000); // Check every 2 seconds

		return () => clearInterval(pollInterval);
	}, [authConnectionId, token, activeNamespace, connectAsync]);

	return (
		<div className="mt-4 p-4 border rounded-md flex flex-col gap-4 text-left">
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
				<AuthRequiredBanner
					serverName={server.displayName || server.qualifiedName}
					authorizationUrl={connectionData.authorizationUrl}
					countdown={countdown}
				/>
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
				<ConnectionButton
					connectionStatus={connectionData?.status}
					isConnecting={isConnecting}
					onConnect={() => connect(undefined)}
				/>
			</div>

			{connectionData?.status === "existing_connection_warning" && (
				<ExistingConnectionWarningBanner
					serverName={serverName}
					onUseExisting={handleUseExisting}
					onCreateNew={handleCreateNew}
					isConnecting={isConnecting}
				/>
			)}

			{connectionData?.status === "error" && (
				<p className="text-destructive text-sm mt-2">
					Error connecting to server
				</p>
			)}
		</div>
	);
};

// Uses server action to get namespace (scoped tokens lack namespaces:read)
async function getDefaultNamespace() {
	const namespaces = await listNamespaces();
	if (namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return namespaces[0].name;
}

const getSmitheryClient = (token: string) => {
	return new Smithery({
		apiKey: token,
		baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	});
};

type ConnectionStatus =
	| { status: "connected"; connection: Connection }
	| { status: "auth_required"; connectionId: string; authorizationUrl?: string }
	| {
			status: "existing_connection_warning";
			existingConnectionId: string;
			name: string;
	  }
	| { status: "error"; error: unknown };

async function checkConnectionStatus(
	client: Smithery,
	connectionId: string,
	namespace: string,
): Promise<ConnectionStatus> {
	try {
		const { transport } = await createConnection({
			client,
			connectionId,
			namespace,
		});
		const mcpClient = await createMCPClient({ transport });

		const tools = await mcpClient.tools();
		console.log("tools list", tools);

		const connection = await client.beta.connect.connections.get(connectionId, {
			namespace: namespace,
		});

		return {
			status: "connected",
			connection,
		};
	} catch (error) {
		if (error instanceof SmitheryAuthorizationError) {
			const authorizationUrl = error.authorizationUrl;
			console.log("connection requires authorization", {
				connectionId,
				namespace,
				authorizationUrl,
			});
			return {
				status: "auth_required",
				connectionId,
				authorizationUrl,
			};
		}
		console.error(
			"error connecting to server",
			`connectionId: ${connectionId}, namespace: ${namespace}`,
			error,
		);
		return {
			status: "error",
			error,
		};
	}
}

async function getOrCreateConnection(
	client: Smithery,
	namespace: string,
	mcpUrl: string,
	name: string,
	onExistingConnection: OnExistingConnectionMode,
): Promise<ConnectionStatus> {
	// Check for existing connection by name
	const existingList = await client.beta.connect.connections.list(namespace, {
		name,
	});
	const existing = existingList.connections[0];

	if (existing) {
		switch (onExistingConnection) {
			case "error":
				return {
					status: "error",
					error: new Error(`Connection "${name}" already exists`),
				};
			case "warn":
				return {
					status: "existing_connection_warning",
					existingConnectionId: existing.connectionId,
					name,
				};
			case "use":
				return checkConnectionStatus(client, existing.connectionId, namespace);
			case "create-new":
				// Continue to create new connection
				break;
		}
	}

	// Create new connection (API auto-generates unique ID)
	console.log("creating connection", name);
	const connection = await client.beta.connect.connections.create(namespace, {
		mcpUrl,
		name,
	});
	console.log("connection", connection);

	if (connection.status?.state === "auth_required") {
		return {
			status: "auth_required",
			connectionId: connection.connectionId,
			authorizationUrl: connection.status?.authorizationUrl,
		};
	}

	console.log("established connection", connection.status?.state, connection);

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
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

interface ExternalURLDisplayProps {
	url: string;
	token: string;
	namespace?: string;
	onExistingConnection: OnExistingConnectionMode;
	onServerConnect?: (connection: Connection) => void;
}

const ExternalURLDisplay = ({
	url,
	token,
	namespace,
	onExistingConnection,
	onServerConnect,
}: ExternalURLDisplayProps) => {
	const queryClient = useQueryClient();
	const [countdown, setCountdown] = useState<number | null>(null);

	const { data: defaultNamespace } = useQuery({
		queryKey: ["defaultNamespace", token],
		queryFn: () => getDefaultNamespace(),
		enabled: !!token,
	});

	const activeNamespace = namespace || defaultNamespace;

	const {
		mutate: connect,
		isPending: isConnecting,
		data: connectionData,
		mutateAsync: connectAsync,
	} = useMutation({
		mutationFn: async (
			overrideMode?: "use" | "create-new",
		): Promise<ConnectionStatus> => {
			if (!token || !activeNamespace) {
				throw new Error("Token and namespace are required");
			}
			const client = getSmitheryClient(token);
			return await getOrCreateConnection(
				client,
				activeNamespace,
				url,
				url,
				overrideMode ?? onExistingConnection,
			);
		},
		onSuccess: (data) => {
			if (data.status === "connected" && onServerConnect) {
				onServerConnect(data.connection);
			}
			queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
		onError: (error) => {
			console.error("error connecting to external URL", error);
		},
	});

	const handleUseExisting = () => {
		connect("use");
	};

	const handleCreateNew = () => {
		connect("create-new");
	};

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
	const authConnectionId =
		connectionData?.status === "auth_required"
			? connectionData.connectionId
			: null;

	useEffect(() => {
		if (!authConnectionId || !token || !activeNamespace) {
			return;
		}

		const pollInterval = setInterval(async () => {
			try {
				const client = getSmitheryClient(token);
				const status = await checkConnectionStatus(
					client,
					authConnectionId,
					activeNamespace,
				);

				if (status.status === "connected") {
					// Update mutation data to trigger re-render
					// Use "use" mode to reuse the existing connection we're polling
					await connectAsync("use");
					setCountdown(null);
				}
			} catch (error) {
				console.error("error checking connection status", error);
			}
		}, 2000); // Check every 2 seconds

		return () => clearInterval(pollInterval);
	}, [authConnectionId, token, activeNamespace, connectAsync]);

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
				<AuthRequiredBanner
					serverName="this server"
					authorizationUrl={connectionData.authorizationUrl}
					countdown={countdown}
				/>
			)}

			<div className="mt-2 flex justify-end gap-4">
				<ConnectionButton
					connectionStatus={connectionData?.status}
					isConnecting={isConnecting}
					onConnect={() => connect(undefined)}
				/>
			</div>

			{connectionData?.status === "existing_connection_warning" && (
				<ExistingConnectionWarningBanner
					serverName={url}
					onUseExisting={handleUseExisting}
					onCreateNew={handleCreateNew}
					isConnecting={isConnecting}
				/>
			)}

			{connectionData?.status === "error" && (
				<p className="text-destructive text-sm mt-2">
					Error connecting to server
				</p>
			)}
		</div>
	);
};

const ServerSearchInner = ({
	token,
	namespace,
	onExistingConnection = "warn",
	onServerConnect,
	query,
	hideSearchAfterConnect,
}: {
	token?: string;
	namespace?: string;
	onExistingConnection?: OnExistingConnectionMode;
	onServerConnect?: (connection: Connection) => void;
	query?: string;
	hideSearchAfterConnect?: boolean;
}) => {
	const [currentQuery, setCurrentQuery] = useState(query || "");
	const [selectedServer, setSelectedServer] =
		useState<ServerListResponse | null>(null);
	const [selectedExternalUrl, setSelectedExternalUrl] = useState<string | null>(
		null,
	);
	const [isConnected, setIsConnected] = useState(false);
	const debouncedQuery = useDebounce(currentQuery, 300);
	const isUrl = isValidUrl(currentQuery);

	const handleServerConnect = (connection: Connection) => {
		setIsConnected(true);
		onServerConnect?.(connection);
	};

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
		// Don't fetch when a server or external URL is already selected
		enabled: !!token && !selectedServer && !selectedExternalUrl,
	});

	const servers = data?.servers ?? [];

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (isUrl) {
				const urlToConnect = currentQuery.trim();
				setSelectedExternalUrl(urlToConnect);
				setSelectedServer(null);
				setTimeout(() => setCurrentQuery(""), 0);
			} else if (servers.length > 0) {
				setSelectedServer(servers[0]);
				setSelectedExternalUrl(null);
				setTimeout(() => setCurrentQuery(""), 0);
			}
		}
	};

	const shouldHideSearch = hideSearchAfterConnect && isConnected;

	return (
		<div className="max-w-md mx-auto">
			{!shouldHideSearch && (
				<Combobox<ServerListResponse>
					value={selectedServer}
					onValueChange={(server) => {
						setSelectedServer(server);
						// Only clear external URL when a server is actually selected
						// (not when combobox fires null from closing without selection)
						if (server) {
							setSelectedExternalUrl(null);
							setCurrentQuery("");
						}
					}}
					inputValue={currentQuery}
					onInputValueChange={(value, eventDetails) => {
						// Only update query for user input, not when combobox auto-fills from selection
						if (eventDetails.reason === "input-change") {
							setCurrentQuery(value);
						}
					}}
					itemToStringLabel={(server) =>
						server.displayName || server.qualifiedName
					}
					defaultOpen={true}
				>
					<ComboboxInput
						placeholder="Search for a server or paste MCP URL..."
						disabled={!token}
						onKeyDown={handleKeyDown}
						autoFocus={true}
					/>
					<ComboboxContent side="bottom" align="start">
						{isUrl ? (
							<div className="p-1">
								<button
									type="button"
									className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
									onClick={() => {
										const urlToConnect = currentQuery.trim();
										setSelectedExternalUrl(urlToConnect);
										setSelectedServer(null);
										setTimeout(() => setCurrentQuery(""), 0);
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
												{currentQuery.trim()}
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
			)}

			{selectedServer && token && namespace && (
				<ServerDisplay
					server={selectedServer}
					token={token}
					namespace={namespace}
					onExistingConnection={onExistingConnection}
					onServerConnect={handleServerConnect}
				/>
			)}

			{selectedExternalUrl && token && (
				<ExternalURLDisplay
					url={selectedExternalUrl}
					token={token}
					onExistingConnection={onExistingConnection}
					onServerConnect={handleServerConnect}
				/>
			)}
		</div>
	);
};

export const ServerSearch = (props: {
	token: string;
	namespace: string;
	query?: string;
	onExistingConnection?: OnExistingConnectionMode;
	hideSearchAfterConnect?: boolean;
	onServerConnect?: (connection: Connection) => void;
}) => (
	<WithQueryClient>
		<ServerSearchInner {...props} />
	</WithQueryClient>
);
