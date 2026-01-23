"use client";

import Smithery from "@smithery/api";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";

async function getDefaultNamespace(client: Smithery) {
	const namespaces = await client.namespaces.list();
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return namespaces.namespaces[0].name;
}

export const ConnectionCard = ({
	connection,
	token,
	namespace,
}: {
	connection: Connection;
	token: string;
	namespace: string;
}) => {
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: async () => {
			const client = new Smithery({
				apiKey: token,
			});
			await client.beta.connect.connections.delete(connection.connectionId, {
				namespace: namespace,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["connections"] });
		},
	});

	return (
		<Card className="border-none shadow-none">
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

export const Connections = ({ token }: { token: string }) => {
	const { data, isLoading, error } = useQuery({
		queryKey: ["connections"],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required");
			}
			const client = new Smithery({
				apiKey: token,
			});
			const namespace = await getDefaultNamespace(client);
			const connections = await client.beta.connect.connections.list(namespace);
			return { connections, namespace };
		},
		enabled: !!token,
	});

	return (
		<div className="max-w-md mx-auto">
			{isLoading && <p className="text-muted-foreground">Loading...</p>}
			{error && <p className="text-destructive">Error: {error.message}</p>}
			{data && (
				<div className="space-y-2 overflow-auto max-h-[500px]">
					{data.connections.connections.map((connection: Connection) => (
						<div key={connection.connectionId}>
							<ConnectionCard
								connection={connection}
								token={token}
								namespace={data.namespace}
							/>
							<Separator />
						</div>
					))}
				</div>
			)}
		</div>
	);
};
