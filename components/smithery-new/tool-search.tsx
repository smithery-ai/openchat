"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Smithery from "@smithery/api"
import { Input } from "../ui/input"
import { ToolSearchResponse } from "@smithery/api/resources/beta/connect/tools.mjs"
import { useDebounce } from "../../hooks/use-debounce"
import { Avatar, AvatarFallback } from "../ui/avatar"
import { Card, CardContent } from "../ui/card"
import { Separator } from "../ui/separator"
import { Spinner } from "../ui/spinner"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "../ui/empty"
import { WrenchIcon } from "lucide-react"
import { ServerSearch } from "./server-search"

async function getDefaultNamespace(client: Smithery) {
	const namespaces = await client.namespaces.list()
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found")
	}
	return namespaces.namespaces[0].name
}

type ToolCardProps = {
	tool: ToolSearchResponse.Tool
}

const ToolCard = ({ tool }: ToolCardProps) => {
	const toolName = tool.tool.name
	const toolDescription = tool.tool.description
	const serverUrl = tool.serverUrl
	const inputSchema = tool.tool.inputSchema

	return (
		<Card className="border-none shadow-none">
			<CardContent className="flex items-center gap-4">
				<Avatar className="h-10 w-10 rounded-md">
					<AvatarFallback className="rounded-md bg-muted">
						<WrenchIcon className="h-5 w-5 text-muted-foreground" />
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					<h3 className="font-medium truncate">{toolName}</h3>
					<p className="text-muted-foreground text-xs truncate">{serverUrl}</p>
					{toolDescription && (
						<p className="text-muted-foreground text-xs truncate">
							{toolDescription}
						</p>
					)}
					{inputSchema && Object.keys(inputSchema).length > 0 && (
						<details className="mt-2">
							<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
								View parameters
							</summary>
							<pre className="mt-2 text-xs bg-muted/50 p-2 rounded overflow-x-auto">
								{JSON.stringify(inputSchema, null, 2)}
							</pre>
						</details>
					)}
				</div>
			</CardContent>
		</Card>
	)
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
		<div className="max-w-md mx-auto">
			<div className="mb-4">
				<Input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search for a tool"
				/>
			</div>

			{debouncedQuery.length > 0 && (
				<>
					{/* Loading State */}
					{isLoading && (
						<div className="flex items-center gap-2 text-muted-foreground py-4">
							<Spinner />
							<span>Searching tools...</span>
						</div>
					)}

					{/* Error State */}
					{error && (
						<div className="rounded-md bg-destructive/10 p-4">
							<p className="text-destructive text-sm">
								Error: {error.message}
							</p>
						</div>
					)}

					{/* Empty State */}
					{!isLoading && !error && data?.tools && data.tools.length === 0 && (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>No tools found</EmptyTitle>
								<EmptyDescription>
									Try a different search term or add a server below
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}

					{/* Unified scrollable container for all results */}
					{!isLoading && !error && (
						<div className="space-y-4 overflow-auto max-h-[500px]">
							{/* Tool Results */}
							{data?.tools && data.tools.length > 0 && (
								<div className="space-y-2">
									{data.tools.map((tool: ToolSearchResponse.Tool) => (
										<div key={`${tool.serverUrl}-${tool.connectionId}-${tool.tool.name}`}>
											<ToolCard tool={tool} />
											<Separator />
										</div>
									))}
								</div>
							)}

							{/* Server Search Section - shows automatically with same query */}
							<div>
								<div>
									<h2 className="text-lg font-semibold">Explore Servers</h2>
									<p className="text-sm text-muted-foreground mt-1">
										If the tool you want isn't showing up, try adding another server
									</p>
								</div>
								<ServerSearch token={token} initialQuery={debouncedQuery} />
							</div>
						</div>
					)}
				</>
			)}
		</div>
	)
}