"use client";

import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useAtomValue } from "jotai";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Connections } from "@/registry/new-york/smithery/connections";
import { selectedTokenAtom } from "@/registry/new-york/smithery/tokens";
import { ChatBlock } from "./chat-block";
import { type NavigationSection, SharedSidebar } from "./shared-sidebar";

export function RegistryBrowser({
	initialTokenResponse,
	namespace,
}: {
	initialTokenResponse: CreateTokenResponse;
	namespace?: string;
}) {
	const searchParams = useSearchParams();
	const apiKey = useAtomValue(selectedTokenAtom);
	const [activeNav, setActiveNav] = useState<NavigationSection>(
		(searchParams.get("nav") as NavigationSection) || "connections",
	);

	return (
		<SharedSidebar
			initialTokenResponse={initialTokenResponse}
			activeNav={activeNav}
			onNavChange={setActiveNav}
		>
			{activeNav === "chat" ? (
				<ChatBlock token={apiKey?.token ?? null} />
			) : apiKey ? (
				<Connections token={apiKey.token} namespace={namespace} />
			) : (
				<div className="p-6 text-muted-foreground">
					No token selected. Please create a token.
				</div>
			)}
		</SharedSidebar>
	);
}
