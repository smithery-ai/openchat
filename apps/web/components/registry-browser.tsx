"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Connections } from "@openchat/registry/smithery/connections";
import { useSmitheryContext } from "@openchat/registry/smithery/smithery-provider";
import { ChatBlock } from "./chat-block";
import { type NavigationSection, SharedSidebar } from "./shared-sidebar";

export function RegistryBrowser() {
	const searchParams = useSearchParams();
	const { token, namespace } = useSmitheryContext();
	const [activeNav, setActiveNav] = useState<NavigationSection>(
		(searchParams.get("nav") as NavigationSection) || "chat",
	);

	return (
		<SharedSidebar activeNav={activeNav} onNavChange={setActiveNav}>
			{activeNav === "chat" && token && namespace ? (
				<ChatBlock />
			) : token ? (
				<Connections />
			) : null}
		</SharedSidebar>
	);
}
