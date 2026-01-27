"use client";

import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { selectedTokenAtom } from "@/registry/new-york/smithery/tokens";
import { Connections } from "@/registry/new-york/smithery/connections";
import { ServerSearch } from "@/registry/new-york/smithery/server-search";
import { ToolSearch } from "@/registry/new-york/smithery/tool-search";
import { SharedSidebar, type NavigationSection } from "./shared-sidebar";

export function RegistryBrowser({
	initialTokenResponse,
	namespace,
}: {
	initialTokenResponse: CreateTokenResponse;
	namespace?: string;
}) {
	const apiKey = useAtomValue(selectedTokenAtom);
	const [activeNav, setActiveNav] = useState<NavigationSection>("connections");

	return (
		<SharedSidebar
			initialTokenResponse={initialTokenResponse}
			activeNav={activeNav}
			onNavChange={setActiveNav}
		>
			{apiKey ? (
				<div className="w-full h-full">
					{activeNav === "servers" && (
						<ServerSearch token={apiKey.token} namespace={namespace} />
					)}
					{activeNav === "connections" && (
						<Connections token={apiKey.token} namespace={namespace} />
					)}
					{activeNav === "tools" && (
						<ToolSearch token={apiKey.token} />
					)}
				</div>
			) : (
				<div className="p-6 text-muted-foreground">
					No token selected. Please create a token.
				</div>
			)}
		</SharedSidebar>
	);
}
