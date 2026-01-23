"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Smithery from "@smithery/api"
import { Input } from "../ui/input"
import { useDebounce } from "../../hooks/use-debounce"
import { ServerListResponse } from "@smithery/api/resources/servers/servers.mjs"

async function getDefaultNamespace(client: Smithery) {
	const namespaces = await client.namespaces.list()
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found")
	}
	return namespaces.namespaces[0].name
}

export const ServerSearch = ({token}: {token?: string}) => {
    const [query, setQuery] = useState("")
	const debouncedQuery = useDebounce(query, 300)

	const { data, isLoading, error } = useQuery({
		queryKey: ["servers", debouncedQuery],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required")
			}
			const client = new Smithery({
				apiKey: token,
			})
			console.log("searching", debouncedQuery)
			const servers = await client.servers.list({ q: debouncedQuery })
			console.log(`servers for ${debouncedQuery}`, servers)
			return servers
		},
		enabled: debouncedQuery.length > 0 && !!token,
	})

	return (
		<div className="max-w-md mx-auto">
			<h1>Server Search</h1>
			<Input
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search for a server"
			/>
			{isLoading && <p>Loading...</p>}
			{error && <p>Error: {error.message}</p>}
			<div className="space-y-2 overflow-auto max-h-[500px] flex flex-col gap-4">
				{data?.servers.map((server: ServerListResponse) => (
					<div key={`${server.qualifiedName}`}>
						<p>{server.qualifiedName}</p>
						<h2>{server.displayName}</h2>
						<p>{server.description}</p>
						<p>{JSON.stringify(server.iconUrl)}</p>
					</div>
				))}
			</div>
		</div>
	)
}