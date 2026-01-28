"use client";

import { Button } from "@/components/ui/button";
import type { Connection } from "@smithery/api/resources/beta/connect/connections";
import { useQuery } from "@tanstack/react-query";

const ToolApproval = () => {
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
	const { data, isLoading, refetch } = useQuery({
		queryKey: ["tool-search", namespace, apiKey],
		queryFn: async () => {
			const response = await fetch("/api/tool-search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ connections, apiKey, namespace }),
			});
			return response.json() as Promise<{ connections: Connection[] }>;
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
			<Button type="button" onClick={() => refetch()}>Refresh</Button>
			{isLoading && <p>Loading...</p>}
			{data && <pre>{JSON.stringify(data, null, 2)}</pre>}
		</div>
	);
}
