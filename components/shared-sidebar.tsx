"use client";

import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import {
	Blocks,
	FileJson,
	Key,
	LayoutGrid,
	Link2,
	Search,
	Server,
	Settings2,
	Square,
	SquareArrowOutUpRight,
	Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "@/components/ui/sidebar";
import { Tokens } from "@/registry/new-york/smithery/tokens";

export const navigationItems: {
	title: string;
	value: NavigationSection;
	icon: typeof Server;
}[] = [
	{ title: "Servers", value: "servers", icon: Server },
	{ title: "Connections", value: "connections", icon: Link2 },
	{ title: "Tools", value: "tools", icon: Wrench },
];

export const componentItems = [
	{ title: "Tokens", slug: "tokens", icon: Key },
	{ title: "Server Search", slug: "server-search", icon: Search },
	{ title: "Connections", slug: "connections", icon: Link2 },
	{ title: "Tool Search", slug: "tool-search", icon: Search },
	{ title: "Tools Panel", slug: "tools-panel", icon: LayoutGrid },
	{ title: "Tool Card", slug: "tool-card", icon: Square },
	{
		title: "Tool Detail Dialog",
		slug: "tool-detail-dialog",
		icon: SquareArrowOutUpRight,
	},
	{ title: "Schema Form", slug: "schema-form", icon: FileJson },
	{ title: "Connection Context", slug: "connection-context", icon: Settings2 },
];

export type NavigationSection = "servers" | "connections" | "tools";

interface SharedSidebarProps {
	initialTokenResponse: CreateTokenResponse;
	activeNav?: NavigationSection;
	onNavChange?: (nav: NavigationSection) => void;
	children: React.ReactNode;
}

export function SharedSidebar({
	initialTokenResponse,
	activeNav,
	onNavChange,
	children,
}: SharedSidebarProps) {
	const pathname = usePathname();
	const isDocsPage = pathname.startsWith("/docs");

	const handleNavClick = (value: NavigationSection) => {
		if (isDocsPage) {
			// Navigate to home with nav param
			window.location.href = `/?nav=${value}`;
		} else if (onNavChange) {
			onNavChange(value);
		}
	};

	return (
		<SidebarProvider>
			<Sidebar>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Navigation</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{navigationItems.map((item) => (
									<SidebarMenuItem key={item.value}>
										<SidebarMenuButton
											onClick={() => handleNavClick(item.value)}
											isActive={!isDocsPage && activeNav === item.value}
										>
											<item.icon />
											<span>{item.title}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarGroup>
						<SidebarGroupLabel>
							<Blocks className="h-4 w-4 mr-2 inline" />
							Components
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{componentItems.map((item) => (
									<SidebarMenuItem key={item.slug}>
										<SidebarMenuButton
											asChild
											isActive={pathname === `/docs/${item.slug}`}
										>
											<Link href={`/docs/${item.slug}`}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
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
					<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
						<SidebarTrigger />
						<Tokens initialTokenResponse={initialTokenResponse} />
					</header>

					<div className="flex-1 overflow-auto">{children}</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
