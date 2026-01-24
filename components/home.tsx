"use client";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useAtomValue } from "jotai";
import { selectedTokenAtom } from "@/lib/atoms";
import { Connections } from "./smithery-new/connections";
import { ServerSearch } from "./smithery-new/server-search";
import { Tokens } from "./smithery-new/tokens";
import { ToolSearch } from "./smithery-new/tool-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

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
				{apiKey ? (
					<>
						<Tokens initialTokenResponse={initialTokenResponse} />
						<Tabs defaultValue="servers" className="w-[400px]">
							<TabsList>
								<TabsTrigger value="servers">Servers</TabsTrigger>
								<TabsTrigger value="connections">Connections</TabsTrigger>
								<TabsTrigger value="tools">Tools</TabsTrigger>
							</TabsList>
							<TabsContent value="servers">
								<ServerSearch token={apiKey.token} namespace={namespace} />
							</TabsContent>
							<TabsContent value="connections">
								<Connections token={apiKey.token} namespace={namespace} />
							</TabsContent>
							<TabsContent value="tools">
								<ToolSearch token={apiKey.token} />
							</TabsContent>
						</Tabs>
					</>
				) : (
					<>
						<Tokens initialTokenResponse={initialTokenResponse} />
						<div>No token selected. Please create a token.</div>
					</>
				)}
			</div>
		</div>
	);
}
