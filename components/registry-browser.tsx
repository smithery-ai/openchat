"use client";

import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { Connections } from "@/registry/new-york/smithery/connections";
import { ServerSearch } from "@/registry/new-york/smithery/server-search";
import { selectedTokenAtom } from "@/registry/new-york/smithery/tokens";
import { type NavigationSection, SharedSidebar } from "./shared-sidebar";

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
						<div className="p-6 text-muted-foreground">
							Tool search is not available in this view. Use the Connections tab
							to browse tools from connected servers.
						</div>
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
