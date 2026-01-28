"use client";

import type { Connection } from "@smithery/api/resources/beta/connect/connections";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const _ToolApproval = () => {
	return (
		<div>
			<p>Tool Approval</p>
		</div>
	);
};

export function Act({
	action,
	connections,
	namespace,
	apiKey,
}: {
	action: string;
	connections: Connection[];
	namespace: string;
	apiKey: string;
}) {
	const { data, isLoading, isFetching, refetch } = useQuery({
		queryKey: ["tool-search", namespace, apiKey],
		queryFn: async () => {
			const response = await fetch("/api/tool-search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ connections, apiKey, namespace, action }),
			});
			return response.json() as Promise<{
				searchResults: any[];
				latency: number;
				totalTools: number;
				tokensProcessed: number;
				connectionLatencies: Record<string, number>;
			}>;
		},
	});

	if (isLoading) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<p>{action}</p>
			{/* <p>
				{data?.connections
					.map((connection) => JSON.stringify(connection))
					.join(", ")}
			</p> */}
			<Button type="button" onClick={() => refetch()} disabled={isFetching}>
				Refresh
			</Button>
			{isFetching && <p>Loading...</p>}
			{data && <pre>{JSON.stringify(data, null, 2)}</pre>}
		</div>
	);
}
