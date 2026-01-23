"use server";
import { Connections } from "@/components/smithery-new/connections";
import { ServerSearch } from "@/components/smithery-new/server-search";
import { ToolSearch } from "@/components/smithery-new/tool-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function Home() {
	const apiKey = process.env.SMITHERY_API_KEY;
	if (!apiKey) {
		throw new Error("SMITHERY_API_KEY is not set");
	}
	return (
		<div className="flex items-center justify-center h-screen">
			<Tabs defaultValue="servers" className="w-[400px]">
				<TabsList>
					<TabsTrigger value="servers">Servers</TabsTrigger>
					<TabsTrigger value="connections">Connections</TabsTrigger>
					<TabsTrigger value="tools">Tools</TabsTrigger>
				</TabsList>
				<TabsContent value="servers">
					<ServerSearch token={apiKey} />
				</TabsContent>
				<TabsContent value="connections">
					<Connections token={apiKey} />
				</TabsContent>
				<TabsContent value="tools">
					<ToolSearch token={apiKey} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
