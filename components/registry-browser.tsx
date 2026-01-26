"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import Smithery from "@smithery/api";
import { SmitheryTransport } from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { useQuery } from "@tanstack/react-query";
import type { Tool, ToolExecutionOptions } from "ai";
import { useAtomValue } from "jotai";
import {
	Blocks,
	Link2,
	Server,
	Wrench,
	FileJson,
	LayoutGrid,
	Square,
	SquareArrowOutUpRight,
	Key,
	Search,
	AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { selectedTokenAtom } from "@/lib/atoms";
import { Connections } from "./smithery-new/connections";
import { ServerSearch } from "./smithery-new/server-search";
import { Tokens } from "./smithery-new/tokens";
import { ToolSearch } from "./smithery-new/tool-search";
import { ToolsPanel } from "./smithery-new/tools-panel";
import { ToolCard } from "./smithery-new/tool-card";
import { ToolDetailDialog } from "./smithery-new/tool-detail-dialog";
import { SchemaForm } from "./smithery-new/schema-form";
import { ConnectionConfigContext } from "./smithery/connection-context";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

const DEFAULT_MCP_URL = "https://mcp.exa.ai";

type NavigationSection = "servers" | "connections" | "tools";
type ComponentSection =
	| "tokens"
	| "server-search"
	| "connections-component"
	| "tool-search"
	| "tools-panel"
	| "tool-card"
	| "tool-detail-dialog"
	| "schema-form";

type ActiveSelection =
	| { type: "navigation"; section: NavigationSection }
	| { type: "component"; section: ComponentSection };

const navigationItems = [
	{ title: "Servers", value: "servers" as NavigationSection, icon: Server },
	{ title: "Connections", value: "connections" as NavigationSection, icon: Link2 },
	{ title: "Tools", value: "tools" as NavigationSection, icon: Wrench },
];

const componentItems = [
	{ title: "Tokens", value: "tokens" as ComponentSection, icon: Key },
	{ title: "Server Search", value: "server-search" as ComponentSection, icon: Search },
	{ title: "Connections", value: "connections-component" as ComponentSection, icon: Link2 },
	{ title: "Tool Search", value: "tool-search" as ComponentSection, icon: Search },
	{ title: "Tools Panel", value: "tools-panel" as ComponentSection, icon: LayoutGrid },
	{ title: "Tool Card", value: "tool-card" as ComponentSection, icon: Square },
	{ title: "Tool Detail Dialog", value: "tool-detail-dialog" as ComponentSection, icon: SquareArrowOutUpRight },
	{ title: "Schema Form", value: "schema-form" as ComponentSection, icon: FileJson },
];

const getSmitheryClient = (token: string) => {
	return new Smithery({
		apiKey: token,
		baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	});
};

async function getDefaultNamespace(client: Smithery) {
	const namespaces = await client.namespaces.list();
	if (namespaces.namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return namespaces.namespaces[0].name;
}

// Hook to fetch connections
function useConnections(token: string | undefined, namespace?: string) {
	return useQuery({
		queryKey: ["connections", token],
		queryFn: async () => {
			if (!token) throw new Error("Token required");
			const client = getSmitheryClient(token);
			const namespaceToUse = namespace || (await getDefaultNamespace(client));
			const { connections } = await client.beta.connect.connections.list(namespaceToUse);
			return { connections, namespace: namespaceToUse };
		},
		enabled: !!token,
	});
}

// Hook to fetch tools from a connection
function useConnectionTools(
	token: string | undefined,
	connectionId: string | null,
	namespace?: string,
) {
	const clientQuery = useQuery({
		queryKey: ["mcp-client", token, connectionId, namespace],
		queryFn: async () => {
			if (!token || !connectionId) throw new Error("Token and connection required");
			const namespaceToUse = namespace || (await getDefaultNamespace(getSmitheryClient(token)));
			const transport = new SmitheryTransport({
				client: getSmitheryClient(token),
				connectionId,
				namespace: namespaceToUse,
			});
			const mcpClient = await createMCPClient({ transport });
			return { client: mcpClient, namespace: namespaceToUse };
		},
		enabled: !!token && !!connectionId,
	});

	const toolsQuery = useQuery({
		queryKey: ["tools", connectionId, token, namespace],
		queryFn: async () => {
			if (!clientQuery.data) throw new Error("Client not available");
			return await clientQuery.data.client.tools();
		},
		enabled: !!clientQuery.data,
	});

	const handleExecute = async (toolName: string, params: Record<string, unknown>) => {
		if (!toolsQuery.data) throw new Error("Tools not available");
		const tool = toolsQuery.data[toolName];
		if (!tool) throw new Error(`Tool ${toolName} not found`);
		const options: ToolExecutionOptions = {
			toolCallId: `manual-${Date.now()}`,
			messages: [],
		};
		return await tool.execute(params, options);
	};

	return {
		tools: toolsQuery.data,
		isLoading: clientQuery.isLoading || toolsQuery.isLoading,
		error: clientQuery.error || toolsQuery.error,
		handleExecute,
		namespace: clientQuery.data?.namespace,
	};
}

// Connection selector component
function ConnectionSelector({
	token,
	namespace,
	selectedConnectionId,
	onSelect,
}: {
	token: string;
	namespace?: string;
	selectedConnectionId: string | null;
	onSelect: (connectionId: string | null) => void;
}) {
	const { data, isLoading, error } = useConnections(token, namespace);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Spinner className="h-4 w-4" />
				Loading connections...
			</div>
		);
	}

	if (error) {
		return (
			<div className="text-sm text-destructive">
				Error loading connections: {error.message}
			</div>
		);
	}

	if (!data?.connections.length) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<AlertCircle className="h-4 w-4" />
				No connections found. Connect to{" "}
				<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{DEFAULT_MCP_URL}</code>{" "}
				first.
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<span className="text-sm text-muted-foreground">Connection:</span>
			<Select
				value={selectedConnectionId || ""}
				onValueChange={(value) => onSelect(value || null)}
			>
				<SelectTrigger className="w-[280px]">
					<SelectValue placeholder="Select a connection" />
				</SelectTrigger>
				<SelectContent>
					{data.connections.map((connection: Connection) => (
						<SelectItem key={connection.connectionId} value={connection.connectionId}>
							{connection.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

// Wrapper for tool-based component previews
function ToolComponentPreview({
	token,
	namespace,
	connectionId,
	children,
}: {
	token: string;
	namespace?: string;
	connectionId: string | null;
	children: (props: {
		tools: Record<string, Tool>;
		handleExecute: (toolName: string, params: Record<string, unknown>) => Promise<unknown>;
		connectionConfig: {
			mcpUrl: string;
			apiKey: string;
			namespace: string;
			connectionId: string;
		};
	}) => React.ReactNode;
}) {
	const { tools, isLoading, error, handleExecute, namespace: resolvedNamespace } = useConnectionTools(
		token,
		connectionId,
		namespace,
	);

	if (!connectionId) {
		return (
			<div className="p-6 text-muted-foreground">
				Please select a connection above to view real tool data.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-6 text-muted-foreground">
				<Spinner className="h-4 w-4" />
				Loading tools from connection...
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6 text-destructive">
				Error loading tools: {error.message}
			</div>
		);
	}

	if (!tools || Object.keys(tools).length === 0) {
		return (
			<div className="p-6 text-muted-foreground">
				No tools found in this connection.
			</div>
		);
	}

	const connectionConfig = {
		mcpUrl: DEFAULT_MCP_URL,
		apiKey: token,
		namespace: resolvedNamespace || "",
		connectionId,
	};

	return (
		<ConnectionConfigContext.Provider value={connectionConfig}>
			{children({ tools, handleExecute, connectionConfig })}
		</ConnectionConfigContext.Provider>
	);
}

function ComponentPreview({
	component,
	apiKey,
	namespace,
	initialTokenResponse,
	selectedConnectionId,
	onConnectionSelect,
}: {
	component: ComponentSection;
	apiKey: CreateTokenResponse | null;
	namespace?: string;
	initialTokenResponse: CreateTokenResponse;
	selectedConnectionId: string | null;
	onConnectionSelect: (connectionId: string | null) => void;
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedToolName, setSelectedToolName] = useState<string | null>(null);

	const handleSchemaSubmit = (data: Record<string, unknown>) => {
		console.log("Schema form submitted:", data);
		alert(`Form submitted!\n\n${JSON.stringify(data, null, 2)}`);
	};

	switch (component) {
		case "tokens":
			return (
				<div className="p-6">
					<h2 className="text-lg font-semibold mb-4">Tokens Component</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Token selector and manager component.
					</p>
					<div className="border rounded-lg p-4">
						<Tokens initialTokenResponse={initialTokenResponse} />
					</div>
				</div>
			);

		case "server-search":
			return (
				<div className="p-6">
					<h2 className="text-lg font-semibold mb-4">Server Search Component</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Search and connect to MCP servers.
						{!apiKey && " Requires a selected token."}
					</p>
					{apiKey && (
						<p className="text-sm text-muted-foreground mb-4">
							Try pasting <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{DEFAULT_MCP_URL}</code> to connect to the Exa MCP server.
						</p>
					)}
					{apiKey ? (
						<ServerSearch token={apiKey.token} namespace={namespace} />
					) : (
						<div className="text-muted-foreground">
							Please select a token to use this component.
						</div>
					)}
				</div>
			);

		case "connections-component":
			return (
				<div className="h-full">
					<div className="p-6 border-b">
						<h2 className="text-lg font-semibold">Connections Component</h2>
						<p className="text-sm text-muted-foreground">
							Manage MCP server connections.
							{!apiKey && " Requires a selected token."}
						</p>
						{apiKey && (
							<p className="text-sm text-muted-foreground mt-2">
								Default server: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{DEFAULT_MCP_URL}</code>
							</p>
						)}
					</div>
					{apiKey ? (
						<div className="h-[calc(100%-100px)]">
							<Connections token={apiKey.token} namespace={namespace} />
						</div>
					) : (
						<div className="p-6 text-muted-foreground">
							Please select a token to use this component.
						</div>
					)}
				</div>
			);

		case "tool-search":
			return (
				<div className="p-6">
					<h2 className="text-lg font-semibold mb-4">Tool Search Component</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Search for tools across connected servers.
						{!apiKey && " Requires a selected token."}
					</p>
					{apiKey && (
						<p className="text-sm text-muted-foreground mb-4">
							Connect to <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{DEFAULT_MCP_URL}</code> first to see available tools.
						</p>
					)}
					{apiKey ? (
						<ToolSearch token={apiKey.token} />
					) : (
						<div className="text-muted-foreground">
							Please select a token to use this component.
						</div>
					)}
				</div>
			);

		case "tools-panel":
			if (!apiKey) {
				return (
					<div className="p-6 text-muted-foreground">
						Please select a token to use this component.
					</div>
				);
			}
			return (
				<div className="h-full flex flex-col">
					<div className="p-6 border-b shrink-0">
						<h2 className="text-lg font-semibold">Tools Panel Component</h2>
						<p className="text-sm text-muted-foreground mb-4">
							Display and interact with a collection of tools from a connected server.
						</p>
						<ConnectionSelector
							token={apiKey.token}
							namespace={namespace}
							selectedConnectionId={selectedConnectionId}
							onSelect={onConnectionSelect}
						/>
					</div>
					<div className="flex-1 overflow-hidden">
						<ToolComponentPreview
							token={apiKey.token}
							namespace={namespace}
							connectionId={selectedConnectionId}
						>
							{({ tools, handleExecute }) => (
								<ToolsPanel tools={tools} onExecute={handleExecute} />
							)}
						</ToolComponentPreview>
					</div>
				</div>
			);

		case "tool-card":
			if (!apiKey) {
				return (
					<div className="p-6 text-muted-foreground">
						Please select a token to use this component.
					</div>
				);
			}
			return (
				<div className="p-6">
					<h2 className="text-lg font-semibold mb-4">Tool Card Component</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Individual tool card with click-to-open detail dialog.
					</p>
					<div className="mb-4">
						<ConnectionSelector
							token={apiKey.token}
							namespace={namespace}
							selectedConnectionId={selectedConnectionId}
							onSelect={onConnectionSelect}
						/>
					</div>
					<ToolComponentPreview
						token={apiKey.token}
						namespace={namespace}
						connectionId={selectedConnectionId}
					>
						{({ tools, handleExecute }) => (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
								{Object.entries(tools).slice(0, 4).map(([name, tool]) => (
									<ToolCard
										key={name}
										name={name}
										tool={tool}
										onExecute={(params) => handleExecute(name, params)}
									/>
								))}
							</div>
						)}
					</ToolComponentPreview>
				</div>
			);

		case "tool-detail-dialog":
			if (!apiKey) {
				return (
					<div className="p-6 text-muted-foreground">
						Please select a token to use this component.
					</div>
				);
			}
			return (
				<div className="p-6">
					<h2 className="text-lg font-semibold mb-4">Tool Detail Dialog Component</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Detailed tool view with parameter form and execution.
					</p>
					<div className="mb-4">
						<ConnectionSelector
							token={apiKey.token}
							namespace={namespace}
							selectedConnectionId={selectedConnectionId}
							onSelect={onConnectionSelect}
						/>
					</div>
					<ToolComponentPreview
						token={apiKey.token}
						namespace={namespace}
						connectionId={selectedConnectionId}
					>
						{({ tools, handleExecute }) => {
							const toolEntries = Object.entries(tools);
							const firstToolName = selectedToolName || toolEntries[0]?.[0];
							const firstTool = firstToolName ? tools[firstToolName] : null;

							if (!firstTool) {
								return <div className="text-muted-foreground">No tools available</div>;
							}

							return (
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">Tool:</span>
										<Select
											value={firstToolName}
											onValueChange={setSelectedToolName}
										>
											<SelectTrigger className="w-[200px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{toolEntries.map(([name]) => (
													<SelectItem key={name} value={name}>
														{name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Button onClick={() => setDialogOpen(true)}>
											Open Dialog
										</Button>
									</div>
									<ToolDetailDialog
										open={dialogOpen}
										onOpenChange={setDialogOpen}
										name={firstToolName}
										tool={firstTool}
										onExecute={(params) => handleExecute(firstToolName, params)}
									/>
								</div>
							);
						}}
					</ToolComponentPreview>
				</div>
			);

		case "schema-form":
			if (!apiKey) {
				return (
					<div className="p-6 text-muted-foreground">
						Please select a token to use this component.
					</div>
				);
			}
			return (
				<div className="p-6">
					<h2 className="text-lg font-semibold mb-4">Schema Form Component</h2>
					<p className="text-sm text-muted-foreground mb-4">
						Dynamic form generated from a tool&apos;s input schema.
					</p>
					<div className="mb-4">
						<ConnectionSelector
							token={apiKey.token}
							namespace={namespace}
							selectedConnectionId={selectedConnectionId}
							onSelect={onConnectionSelect}
						/>
					</div>
					<ToolComponentPreview
						token={apiKey.token}
						namespace={namespace}
						connectionId={selectedConnectionId}
					>
						{({ tools }) => {
							const toolEntries = Object.entries(tools);
							const firstToolName = selectedToolName || toolEntries[0]?.[0];
							const firstTool = firstToolName ? tools[firstToolName] : null;

							if (!firstTool?.inputSchema) {
								return <div className="text-muted-foreground">No tool with schema available</div>;
							}

							return (
								<div className="space-y-4 max-w-md">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">Tool schema:</span>
										<Select
											value={firstToolName}
											onValueChange={setSelectedToolName}
										>
											<SelectTrigger className="w-[200px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{toolEntries.map(([name]) => (
													<SelectItem key={name} value={name}>
														{name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="border rounded-lg p-4">
										<SchemaForm
											schema={firstTool.inputSchema}
											onSubmit={handleSchemaSubmit}
										/>
									</div>
								</div>
							);
						}}
					</ToolComponentPreview>
				</div>
			);

		default:
			return null;
	}
}

export function RegistryBrowser({
	initialTokenResponse,
	namespace,
}: {
	initialTokenResponse: CreateTokenResponse;
	namespace?: string;
}) {
	const apiKey = useAtomValue(selectedTokenAtom);
	const [activeSelection, setActiveSelection] = useState<ActiveSelection>({
		type: "navigation",
		section: "servers",
	});
	const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

	const isNavigationActive = (section: NavigationSection) =>
		activeSelection.type === "navigation" && activeSelection.section === section;

	const isComponentActive = (section: ComponentSection) =>
		activeSelection.type === "component" && activeSelection.section === section;

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
											onClick={() =>
												setActiveSelection({ type: "navigation", section: item.value })
											}
											isActive={isNavigationActive(item.value)}
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
									<SidebarMenuItem key={item.value}>
										<SidebarMenuButton
											onClick={() =>
												setActiveSelection({ type: "component", section: item.value })
											}
											isActive={isComponentActive(item.value)}
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
					<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
						<SidebarTrigger />
						<Tokens initialTokenResponse={initialTokenResponse} />
					</header>

					<div className="flex-1 overflow-auto">
						{activeSelection.type === "navigation" ? (
							apiKey ? (
								<div className="w-full h-full">
									{activeSelection.section === "servers" && (
										<ServerSearch token={apiKey.token} namespace={namespace} />
									)}
									{activeSelection.section === "connections" && (
										<Connections token={apiKey.token} namespace={namespace} />
									)}
									{activeSelection.section === "tools" && (
										<ToolSearch token={apiKey.token} />
									)}
								</div>
							) : (
								<div className="p-6 text-muted-foreground">
									No token selected. Please create a token.
								</div>
							)
						) : (
							<ComponentPreview
								component={activeSelection.section}
								apiKey={apiKey}
								namespace={namespace}
								initialTokenResponse={initialTokenResponse}
								selectedConnectionId={selectedConnectionId}
								onConnectionSelect={setSelectedConnectionId}
							/>
						)}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
