"use client";

import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { ConnectionCard } from "@/registry/new-york/smithery/connection-card";
import { WithQueryClient } from "@/registry/new-york/smithery/query-client-wrapper";
import { ServerSearch } from "@/registry/new-york/smithery/server-search";
import {
	getDefaultNamespace,
	getSmitheryClient,
} from "@/registry/new-york/smithery/smithery-utils";

const ConnectionsListInner = ({
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
				{isLoading && <p className="text-muted-foreground px-6">Loading...</p>}
				{error && (
					<p className="text-destructive px-6">Error: {error.message}</p>
				)}
				{data && (
					<div className="overflow-auto flex-1">
						{data.connections.length === 0 && (
							<p className="text-muted-foreground px-6">No connections found</p>
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

export const ConnectionsList = (props: {
	token: string;
	namespace?: string;
	defaultActiveConnectionId?: string;
	onActiveConnectionIdChange: (connectionId: string) => void;
	defaultShowSearchServers?: boolean;
}) => (
	<WithQueryClient>
		<ConnectionsListInner {...props} />
	</WithQueryClient>
);
