"use client";

import type { Connection } from "@smithery/api/resources/experimental/connect/connections.mjs";
import type { ServerListResponse } from "@smithery/api/resources/index.mjs";
import { AlertCircle, CheckCircle, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { checkConnection } from "./actions";
import type { ConnectionConfig } from "./types";

type ConnectionStatus = "connecting" | "connected" | "auth_required" | "error";

type ServerPillProps = {
	connection: Connection;
	onRemove?: (serverId: string) => void;
	enablePolling?: boolean;
	apiKey?: string | null;
};

// Utility functions
function _getServerName(
	connectionConfig: ConnectionConfig,
	serverInfo?: ServerListResponse,
): string {
	if (serverInfo) {
		return serverInfo.displayName;
	}
	try {
		return new URL(connectionConfig.serverUrl).hostname;
	} catch {
		return connectionConfig.serverUrl;
	}
}

function _getServerUrl(
	connectionConfig: ConnectionConfig,
	serverInfo?: ServerListResponse,
): string {
	return serverInfo ? serverInfo.qualifiedName : connectionConfig.serverUrl;
}

export function ServerPill({
	connection,
	onRemove,
	apiKey,
	enablePolling = true,
}: ServerPillProps) {
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("connecting");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

	const serverInfo = useMemo(
		() => ({
			id: connection.connectionId,
			name:
				connection.serverInfo?.title ??
				connection.serverInfo?.name ??
				connection.name,
			url: connection.mcpUrl,
			iconUrl: connection.serverInfo?.icons?.[0]?.src ?? null,
		}),
		[connection],
	);

	const startPolling = useCallback(() => {
		if (!enablePolling) return;

		const poll = async () => {
			try {
				const result = await checkConnection(serverInfo.url, apiKey);

				if (result.status === "success") {
					setConnectionStatus("connected");
					setErrorMessage(null);
					if (pollIntervalRef.current) {
						clearInterval(pollIntervalRef.current);
						pollIntervalRef.current = null;
					}
				} else if (result.status === "needs_auth") {
					setConnectionStatus("auth_required");
				} else if (result.status === "error") {
					setConnectionStatus("error");
					setErrorMessage("Connection failed");
					if (pollIntervalRef.current) {
						clearInterval(pollIntervalRef.current);
						pollIntervalRef.current = null;
					}
				}
			} catch (err) {
				setConnectionStatus("error");
				setErrorMessage(
					err instanceof Error ? err.message : "Connection check failed",
				);
				if (pollIntervalRef.current) {
					clearInterval(pollIntervalRef.current);
					pollIntervalRef.current = null;
				}
			}
		};

		poll();
		pollIntervalRef.current = setInterval(poll, 3000);
	}, [enablePolling, serverInfo.url, apiKey]);

	useEffect(() => {
		if (enablePolling) {
			startPolling();
		}

		return () => {
			if (pollIntervalRef.current) {
				clearInterval(pollIntervalRef.current);
			}
		};
	}, [enablePolling, startPolling]);

	const { variant, statusIcon, statusText, statusColorClass } = useMemo(() => {
		switch (connectionStatus) {
			case "connecting":
				return {
					variant: "outline" as const,
					statusIcon: <Spinner className="size-3" />,
					statusText: "Connecting",
					statusColorClass: "text-muted-foreground",
				};
			case "connected":
				return {
					variant: "default" as const,
					statusIcon: <CheckCircle className="size-3" />,
					statusText: "Connected",
					statusColorClass: "text-green-600",
				};
			case "auth_required":
				return {
					variant: "outline" as const,
					statusIcon: <AlertCircle className="size-3 text-amber-500" />,
					statusText: "Auth Required",
					statusColorClass: "text-amber-500",
				};
			case "error":
				return {
					variant: "destructive" as const,
					statusIcon: <XCircle className="size-3" />,
					statusText: "Error",
					statusColorClass: "text-destructive",
				};
		}
	}, [connectionStatus]);

	const handleRemove = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (onRemove) {
				onRemove(serverInfo.id);
			}
		},
		[onRemove, serverInfo.id],
	);

	return (
		<Tooltip delayDuration={200}>
			<TooltipTrigger asChild>
				<Badge
					variant={variant}
					className="mr-2 gap-1.5 pr-1 transition-all duration-200 cursor-pointer"
				>
					{serverInfo.iconUrl && (
						<img
							src={serverInfo.iconUrl}
							alt=""
							className="size-3 rounded shrink-0"
						/>
					)}
					{statusIcon}
					<span className="max-w-[150px] truncate">{serverInfo.name}</span>
					{onRemove && (
						<button
							type="button"
							onClick={handleRemove}
							className="ml-1 hover:bg-background/20 rounded-sm p-0.5"
						>
							<X className="size-2.5" />
						</button>
					)}
				</Badge>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-xs">
				<div className="space-y-1 text-xs">
					<div className="font-medium">{serverInfo.name}</div>
					<div className="text-muted-foreground">{connection.mcpUrl}</div>
					<div className="flex items-center gap-1">
						<span>Status:</span>
						<span className={statusColorClass}>{statusText}</span>
					</div>
					{errorMessage && (
						<div className="text-destructive">{errorMessage}</div>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
