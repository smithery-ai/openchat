"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Connections } from "@/registry/new-york/smithery/connections";
import { useSmitheryContext } from "@/registry/new-york/smithery/smithery-provider";
import { ChatBlock } from "./chat-block";
import { type NavigationSection, SharedSidebar } from "./shared-sidebar";

export function RegistryBrowser() {
	const searchParams = useSearchParams();
	const { data: smitheryData, isLoading, error } = useSmitheryContext();
	const [activeNav, setActiveNav] = useState<NavigationSection>(
		(searchParams.get("nav") as NavigationSection) || "chat",
	);

	return (
		<SharedSidebar activeNav={activeNav} onNavChange={setActiveNav}>
			{activeNav === "chat" && smitheryData?.token && smitheryData?.namespace ? (
				<ChatBlock />
			) : smitheryData?.token ? (
				<Connections />
			) : null}
		</SharedSidebar>
	);
}
