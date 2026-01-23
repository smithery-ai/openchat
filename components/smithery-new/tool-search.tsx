"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Smithery from "@smithery/api"
import { Input } from "../ui/input"
import { ToolSearchResponse } from "@smithery/api/resources/beta/connect/tools.mjs"
import { useDebounce } from "../../hooks/use-debounce"

async function getDefaultNamespace(client: Smithery) {
	const namespaces = await client.namespaces.list()
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found")
	}
	return namespaces.namespaces[0].name
}

export const ToolSearch = ({token}: {token?: string}) => {
    const [query, setQuery] = useState("")
	const debouncedQuery = useDebounce(query, 300)

	const { data, isLoading, error } = useQuery({
		queryKey: ["tools", debouncedQuery],
		queryFn: async () => {
			if (!token) {
				throw new Error("API token is required")
			}
			const client = new Smithery({
				apiKey: token,
			})
			console.log("searching", debouncedQuery)
			const namespace = await getDefaultNamespace(client)
			const tools = await client.beta.connect.tools.search(namespace, { q: debouncedQuery })
			console.log(`tools for ${debouncedQuery}`, tools)
			return tools
		},
		enabled: debouncedQuery.length > 0 && !!token,
	})

	return (
		<div className="max-w-xl mx-auto">
			<h1>Tool Search</h1>
			<Input
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search for a tool"
			/>
			{isLoading && <p>Loading...</p>}
			{error && <p>Error: {error.message}</p>}
			<div className="space-y-2 overflow-auto max-h-[500px] flex flex-col gap-4">
				{data?.tools.map((tool: ToolSearchResponse.Tool) => (
					<div key={`${tool.serverUrl}-${tool.connectionId}-${tool.tool.name}`}>
						<p>{tool.serverUrl}</p>
						<h2>{tool.tool.name}</h2>
						<p>{tool.tool.description}</p>
						<p>{JSON.stringify(tool.tool.inputSchema)}</p>
					</div>
				))}
			</div>
		</div>
	)
}