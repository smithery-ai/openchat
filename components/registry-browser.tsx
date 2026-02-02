"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Connections } from "@/registry/new-york/smithery/connections";
import { useSmitheryContext } from "@/registry/new-york/smithery/smithery-provider";
import { ChatBlock } from "./chat-block";
import { type NavigationSection, SharedSidebar } from "./shared-sidebar";

export function RegistryBrowser() {
	const searchParams = useSearchParams();
	const { token } = useSmitheryContext();
	const [activeNav, setActiveNav] = useState<NavigationSection>(
		(searchParams.get("nav") as NavigationSection) || "chat",
	);

	return (
		<SharedSidebar activeNav={activeNav} onNavChange={setActiveNav}>
			{activeNav === "chat" ? (
				<ChatBlock />
			) : token ? (
				<Connections />
			) : (
				<div className="p-6 text-muted-foreground">
					No token selected. Please create a token.
				</div>
			)}
		</SharedSidebar>
	);
}
