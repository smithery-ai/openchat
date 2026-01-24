"use client";
import { Connections } from "./smithery-new/connections";
import { ServerSearch } from "./smithery-new/server-search";
import { ToolSearch } from "./smithery-new/tool-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { Tokens } from "./smithery-new/tokens";
import { useAtom, useAtomValue } from "jotai";
import { selectedTokenAtom } from "@/lib/atoms";

export function HomePage({
	initialTokenResponse,
	namespace,
}: {
	initialTokenResponse: CreateTokenResponse;
	namespace?: string;
}) {
    const apiKey = useAtomValue(selectedTokenAtom);
	return (
		<div className="flex items-center justify-center h-screen">
			<div className="flex flex-col gap-4">
				<Tokens initialTokenResponse={initialTokenResponse} />
				{apiKey ? <Tabs defaultValue="servers" className="w-[400px]">
					<TabsList>
						<TabsTrigger value="servers">Servers</TabsTrigger>
						<TabsTrigger value="connections">Connections</TabsTrigger>
						<TabsTrigger value="tools">Tools</TabsTrigger>
					</TabsList>
					<TabsContent value="servers">
						<ServerSearch token={apiKey.token} />
					</TabsContent>
					<TabsContent value="connections">
						<Connections token={apiKey.token} namespace={namespace} />
					</TabsContent>
					<TabsContent value="tools">
						<ToolSearch token={apiKey.token} />
					</TabsContent>
				</Tabs> : <div>No token selected. Please create a token.</div>}
			</div>
		</div>
	);
}
