"use client"

import type { ServerListResponse } from "@smithery/api/resources/index.mjs"
import type { ConnectionConfig } from "./types"
import { useCallback, useEffect, useRef, useState } from "react"
import { checkConnection, searchServers, useServer } from "./actions"

type ConnectionStatus = "connecting" | "connected" | "auth_required" | "error"

export const ServerSearch = ({
	query,
	onServerConnect,
	apiKey,
}: {
	query: string
	onServerConnect: (
		server: ServerListResponse,
		connectionConfig: ConnectionConfig,
	) => void
	apiKey?: string | null
}) => {
	const [isEditing, setIsEditing] = useState(false)
	const [currentQuery, setCurrentQuery] = useState(query)
	const [servers, setServers] = useState<ServerListResponse[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [selectedServer, setSelectedServer] =
		useState<ServerListResponse | null>(null)
	const [connection, setConnection] = useState<{
		status: ConnectionStatus
		connectionConfig: ConnectionConfig
	} | null>(null)
	const [authUrl, setAuthUrl] = useState<string | null>(null)
	const [statusMessage, setStatusMessage] = useState<string>("")
	const hasSearchedRef = useRef(false)
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
	const connectedConfigIdRef = useRef<string | null>(null)

	useEffect(() => {
		if (
			connection &&
			connection.status === "connected" &&
			selectedServer &&
			connectedConfigIdRef.current !== connection.connectionConfig.configId
		) {
			connectedConfigIdRef.current = connection.connectionConfig.configId
			onServerConnect(selectedServer, connection.connectionConfig)
		}
	}, [connection, selectedServer, onServerConnect])

	const executeSearch = useCallback(
		async (searchQuery: string) => {
			setIsLoading(true)
			setError(null)
			try {
				const results = await searchServers(searchQuery, 5, apiKey)
				setServers(results)
			} catch (err) {
				setError(err instanceof Error ? err.message : "Search failed")
			} finally {
				setIsLoading(false)
			}
		},
		[apiKey],
	)

	useEffect(() => {
		if (!query || hasSearchedRef.current) return
		hasSearchedRef.current = true
		executeSearch(query)
	}, [query, executeSearch])

	const startPolling = useCallback(
		(serverName: string) => {
			const poll = async () => {
				try {
					const result = await checkConnection(serverName, apiKey)
					setStatusMessage(`Status: ${result.status}`)

					if (result.status === "success") {
						setConnection({
							status: "connected",
							connectionConfig: { serverUrl: serverName, configId: serverName },
						})
						if (pollIntervalRef.current) {
							clearInterval(pollIntervalRef.current)
							pollIntervalRef.current = null
						}
					} else if (result.status === "needs_auth") {
						setConnection({
							status: "auth_required",
							connectionConfig: { serverUrl: serverName, configId: serverName },
						})
					} else if (result.status === "error") {
						setConnection({
							status: "error",
							connectionConfig: { serverUrl: serverName, configId: serverName },
						})
						if (pollIntervalRef.current) {
							clearInterval(pollIntervalRef.current)
							pollIntervalRef.current = null
						}
					}
				} catch (err) {
					setConnection({
						status: "error",
						connectionConfig: { serverUrl: serverName, configId: serverName },
					})
					setStatusMessage(
						err instanceof Error ? err.message : "Connection check failed",
					)
					if (pollIntervalRef.current) {
						clearInterval(pollIntervalRef.current)
						pollIntervalRef.current = null
					}
				}
			}

			poll()
			pollIntervalRef.current = setInterval(poll, 3000)
		},
		[apiKey],
	)

	useEffect(() => {
		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current)
			}
		}
	}, [])

	const handleUseServer = async (server: ServerListResponse) => {
		setSelectedServer(server)
		setConnection({
			status: "connecting",
			connectionConfig: {
				serverUrl: `https://server.smithery.ai/${server.qualifiedName}/mcp`,
				configId: server.qualifiedName,
			},
		})
		setStatusMessage("Connecting to server...")
		setError(null)

		try {
			const result = await useServer(server.qualifiedName, apiKey)

			if (result.status === "connected") {
				setConnection({
					status: "connected",
					connectionConfig: result.connectionConfig,
				})
				setStatusMessage("Successfully connected")
				startPolling(server.qualifiedName)
			} else if (result.status === "auth_required") {
				setConnection({
					status: "auth_required",
					connectionConfig: {
						serverUrl: `https://server.smithery.ai/${server.qualifiedName}/mcp`,
						configId: server.qualifiedName,
					},
				})
				setAuthUrl(result.authorizationUrl)
				setStatusMessage("Authentication required")
				window.open(result.authorizationUrl, "_blank")
				startPolling(server.qualifiedName)
			}
		} catch (err) {
			setConnection({
				status: "error",
				connectionConfig: {
					serverUrl: server.qualifiedName,
					configId: server.qualifiedName,
				},
			})
			setStatusMessage(err instanceof Error ? err.message : "Failed to connect")
		}
	}

	const handleBack = () => {
		if (pollIntervalRef.current) {
			clearInterval(pollIntervalRef.current)
			pollIntervalRef.current = null
		}
		connectedConfigIdRef.current = null
		setSelectedServer(null)
		setConnection(null)
		setAuthUrl(null)
		setStatusMessage("")
	}

	const handleResubmit = () => {
		if (!currentQuery.trim()) return
		setIsEditing(false)
		executeSearch(currentQuery)
	}

	if (selectedServer) {
		return (
			<div className="space-y-3 max-w-xl mx-auto p-4 border rounded bg-muted/20">
				<div className="flex items-center gap-2">
					{connection &&
						connection.status !== "connected" &&
						connection.status !== "connecting" && (
							<button
								type="button"
								onClick={handleBack}
								className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground border rounded hover:bg-muted"
							>
								← Back
							</button>
						)}
					<h3 className="text-sm font-medium">Server Connection</h3>
				</div>

				<div className="flex items-center gap-3 p-3 border rounded bg-background">
					{selectedServer.iconUrl ? (
						<img
							src={selectedServer.iconUrl}
							alt=""
							className="size-8 rounded shrink-0"
						/>
					) : (
						<div className="size-8 rounded bg-muted shrink-0" />
					)}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-medium">{selectedServer.displayName}</span>
							{selectedServer.verified && (
								<span className="text-green-600 text-xs" title="Verified">
									✓
								</span>
							)}
						</div>
						<span className="text-xs text-muted-foreground">
							{selectedServer.qualifiedName}
						</span>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium">Status:</span>
						{connection && connection.status === "connecting" && (
							<span className="text-xs text-blue-600">Connecting...</span>
						)}
						{connection && connection.status === "connected" && (
							<span className="text-xs text-green-600">✓ Connected</span>
						)}
						{connection && connection.status === "auth_required" && (
							<span className="text-xs text-yellow-600">
								⚠ Authentication Required
							</span>
						)}
						{connection && connection.status === "error" && (
							<span className="text-xs text-destructive">✗ Error</span>
						)}
					</div>

					{connection && connection.status === "auth_required" && authUrl && (
						<div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
							<p className="text-xs mb-2">
								You should be automatically redirected to authenticate. If not,
								click the link below:
							</p>
							<a
								href={authUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs text-blue-500 hover:underline break-all"
							>
								Open authentication window
							</a>
						</div>
					)}

					{connection && connection.status === "error" && (
						<div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
							{statusMessage || "Failed to connect to server"}
						</div>
					)}
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-1 max-w-xl mx-auto">
			{query && (
				<div className="flex items-center gap-2">
					{isEditing ? (
						<>
							<input
								type="text"
								value={currentQuery}
								onChange={(e) => setCurrentQuery(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleResubmit()}
								className="flex-1 text-sm px-2 py-1 border rounded bg-background"
							/>
							<button
								type="button"
								onClick={handleResubmit}
								className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
							>
								Search
							</button>
							<button
								type="button"
								onClick={() => {
									setIsEditing(false)
									setCurrentQuery(query)
								}}
								className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
							>
								Cancel
							</button>
						</>
					) : (
						<>
							<h3 className="text-sm font-medium text-muted-foreground">
								Searching for servers matching: <strong>{currentQuery}</strong>
							</h3>
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="text-xs px-2 py-0.5 text-muted-foreground hover:text-foreground border rounded hover:bg-muted"
							>
								Edit
							</button>
						</>
					)}
				</div>
			)}
			{error && (
				<div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
					{error}
				</div>
			)}
			{isLoading ? (
				<p className="text-xs text-muted-foreground">Searching...</p>
			) : servers?.length === 0 ? (
				<p className="text-xs text-muted-foreground">No servers found</p>
			) : (
				servers?.map((server) => (
					<div
						key={`list-server-${server.qualifiedName}`}
						className="flex items-center gap-2 py-1 text-xs"
					>
						{server.iconUrl ? (
							<img
								src={server.iconUrl}
								alt=""
								className="size-4 rounded shrink-0"
							/>
						) : (
							<div className="size-4 rounded bg-muted shrink-0" />
						)}
						<span className="font-medium truncate">{server.displayName}</span>
						{server.verified && (
							<span className="text-green-600" title="Verified">
								✓
							</span>
						)}
						<span className="text-muted-foreground truncate">
							{server.qualifiedName}
						</span>
						<span className="text-muted-foreground ml-auto shrink-0">
							{server.useCount.toLocaleString()} uses
						</span>
						<a
							href={`https://smithery.ai/server/${server.qualifiedName}`}
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-500 hover:underline shrink-0"
						>
							View
						</a>
						<button
							type="button"
							onClick={() => handleUseServer(server)}
							className="text-xs px-2 py-0.5 text-muted-foreground hover:text-foreground border rounded hover:bg-muted disabled:opacity-50"
						>
							Use
						</button>
					</div>
				))
			)}
		</div>
	)
}
