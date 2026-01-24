"use server";
import { Connections } from "@/components/smithery-new/connections";
import { Tokens } from "@/components/smithery-new/tokens";
import { ServerSearch } from "@/components/smithery-new/server-search";
import { ToolSearch } from "@/components/smithery-new/tool-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiKey, getDefaultNamespace } from "@/lib/actions";
import { useQuery } from "@tanstack/react-query";
import { HomePage } from "@/components/home";
import { Suspense } from "react";
import Smithery from "@smithery/api";

export default async function Home() {
	const initialTokenResponse = await getApiKey();
	const namespace = await getDefaultNamespace();
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<HomePage initialTokenResponse={initialTokenResponse} namespace={namespace} />
		</Suspense>
	);
}
