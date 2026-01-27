"use client";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useAtomValue } from "jotai";
import { Link2, Server, Wrench } from "lucide-react";
import { useState } from "react";
import { selectedTokenAtom } from "@/lib/atoms";
import { Connections } from "./smithery-new/connections";
import { ServerSearch } from "./smithery-new/server-search";
import { Tokens } from "./smithery-new/tokens";
import { ToolSearch } from "./smithery-new/tool-search";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "./ui/sidebar";

type Section = "servers" | "connections" | "tools";

export function HomePage({
	initialTokenResponse,
	namespace,
}: {
	initialTokenResponse: CreateTokenResponse;
	namespace?: string;
}) {
	const apiKey = useAtomValue(selectedTokenAtom);
	const [activeSection, setActiveSection] = useState<Section>("connections");

	const menuItems = [
		{
			title: "Connections",
			value: "connections" as Section,
			icon: Link2,
		},
		{
			title: "Servers",
			value: "servers" as Section,
			icon: Server,
		},
		{
			title: "Tools",
			value: "tools" as Section,
			icon: Wrench,
		},
	];

	return (
		<SidebarProvider>
			<Sidebar>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Navigation</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{menuItems.map((item) => (
									<SidebarMenuItem key={item.value}>
										<SidebarMenuButton
											onClick={() => setActiveSection(item.value)}
											isActive={activeSection === item.value}
										>
											<item.icon />
											<span>{item.title}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
			<SidebarInset className="overflow-hidden">
				<div className="flex flex-col h-screen">
					<header className="flex h-16 shrink-0 items-center gap-2 border-b-3 px-4">
						<SidebarTrigger />
						<Tokens initialTokenResponse={initialTokenResponse} />
					</header>
					<div className="flex-1 overflow-auto">
						{apiKey ? (
							<div className="w-full h-full">
								{activeSection === "servers" && (
									<ServerSearch token={apiKey.token} namespace={namespace} />
								)}
								{activeSection === "connections" && (
									<Connections token={apiKey.token} namespace={namespace} />
								)}
								{activeSection === "tools" && (
									<ToolSearch token={apiKey.token} />
								)}
							</div>
						) : (
							<div>No token selected. Please create a token.</div>
						)}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
