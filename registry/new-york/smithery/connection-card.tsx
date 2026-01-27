"use client";

import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { WithQueryClient } from "@/registry/new-york/smithery/query-client-wrapper";
import { getSmitheryClient } from "@/registry/new-york/smithery/smithery-utils";

const ConnectionCardInner = ({
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
						{connection.serverInfo?.title ??
							connection.serverInfo?.name ??
							connection.name}
						{connection.connectionId && (
							<span className="ml-2 text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
								{"•".repeat(Math.min(connection.connectionId.length - 10, 4))}
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

export const ConnectionCard = (
	props: {
		connection: Connection;
		token: string;
		namespace: string;
		className?: string;
	} & React.HTMLAttributes<HTMLDivElement>,
) => (
	<WithQueryClient>
		<ConnectionCardInner {...props} />
	</WithQueryClient>
);
