"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import Smithery from "@smithery/api";
import { createConnection } from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/experimental/connect/connections.mjs";
import { useQuery } from "@tanstack/react-query";
import type { ToolExecutionOptions } from "ai";
import { AlertCircle } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
	ComboboxValue,
	useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ConnectionConfigContext } from "@/registry/new-york/smithery/connection-context";
import { Connections } from "@/registry/new-york/smithery/connections";
import { SchemaForm } from "@/registry/new-york/smithery/schema-form";
import { ServerSearch } from "@/registry/new-york/smithery/server-search";
import { useSmitheryContext } from "@/registry/new-york/smithery/smithery-provider";
import { ToolCard } from "@/registry/new-york/smithery/tool-card";
import { ToolDetailDialog } from "@/registry/new-york/smithery/tool-detail-dialog";
import { ToolSearch } from "@/registry/new-york/smithery/tool-search";
import { ToolsPanel } from "@/registry/new-york/smithery/tools-panel";
import type { ToolSearchResult } from "@/registry/new-york/smithery/types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "../ui/dialog";
import { PreviewFrame } from "./preview-frame";

const DEFAULT_MCP_URL = "https://mcp.exa.ai";

const getSmitheryClient = (token: string) => {
	return new Smithery({
		apiKey: token,
		baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	});
};

function useConnections(token: string, namespace: string) {
	return useQuery({
		queryKey: ["connections", token, namespace],
		queryFn: async () => {
			const client = getSmitheryClient(token);
			const { connections } =
				await client.experimental.connect.connections.list(namespace);
			return { connections, namespace };
		},
	});
}

function useConnectionTools(
	token: string,
	connectionId: string | null,
	namespace: string,
) {
	const clientQuery = useQuery({
		queryKey: ["mcp-client", token, connectionId, namespace],
		queryFn: async () => {
			if (!connectionId) throw new Error("Connection required");
			const { transport } = await createConnection({
				client: getSmitheryClient(token),
				connectionId,
				namespace,
			});
			const mcpClient = await createMCPClient({ transport });
			return { client: mcpClient, namespace };
		},
		enabled: !!connectionId,
	});

	const toolsQuery = useQuery({
		queryKey: ["tools", connectionId, token, namespace],
		queryFn: async () => {
			if (!clientQuery.data) throw new Error("Client not available");
			return await clientQuery.data.client.tools();
		},
		enabled: !!clientQuery.data,
	});

	const handleExecute = async (
		toolName: string,
		params: Record<string, unknown>,
	) => {
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

function ConnectionSelector({
	selectedConnectionIds,
	onSelectMultiple,
	multiple = false,
}: {
	selectedConnectionIds: string[];
	onSelectMultiple: (connectionIds: string[]) => void;
	multiple?: boolean;
}) {
	const { token, namespace } = useSmitheryContext();
	const { data, isLoading, error } = useConnections(token, namespace);
	const anchor = useComboboxAnchor();
	const connections = data?.connections ?? [];
	const connectionItems = React.useMemo(
		() => connections.map((c: Connection) => c.connectionId),
		[connections],
	);

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
			<div className="text-sm text-destructive">Error: {error.message}</div>
		);
	}

	if (!connections.length) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<AlertCircle className="h-4 w-4" />
				No connections. Connect to{" "}
				<code className="bg-muted px-1 py-0.5 rounded text-xs">
					{DEFAULT_MCP_URL}
				</code>{" "}
				first.
			</div>
		);
	}

	if (multiple) {
		return (
			<Combobox
				multiple
				autoHighlight
				items={connectionItems}
				value={selectedConnectionIds}
				onValueChange={(values) => {
					onSelectMultiple(values ?? []);
				}}
			>
				<ComboboxChips ref={anchor} className="w-[280px]">
					<ComboboxValue>
						{(values) => (
							<React.Fragment>
								{values.map((value: string) => {
									const connection = connections.find(
										(c: Connection) => c.connectionId === value,
									);
									return (
										<ComboboxChip key={value}>
											{connection?.name || value}
										</ComboboxChip>
									);
								})}
								<ComboboxChipsInput placeholder="Select connections" />
							</React.Fragment>
						)}
					</ComboboxValue>
				</ComboboxChips>
				<ComboboxContent anchor={anchor}>
					<ComboboxEmpty>No connections found.</ComboboxEmpty>
					<ComboboxList>
						{(item) => {
							const connection = connections.find(
								(c: Connection) => c.connectionId === item,
							);
							return (
								<ComboboxItem key={item} value={item}>
									{connection?.name || item}
								</ComboboxItem>
							);
						}}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		);
	}

	return (
		<Combobox
			value={selectedConnectionIds[0] ?? null}
			onValueChange={(value) => onSelectMultiple(value ? [value] : [])}
		>
			<ComboboxTrigger className="border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-[280px] items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9">
				<ComboboxValue placeholder="Select a connection">
					{(value) => {
						const connection = connections.find(
							(c: Connection) => c.connectionId === value,
						);
						return (
							<span className="line-clamp-1 flex items-center gap-2">
								{connection?.name || ""}
							</span>
						);
					}}
				</ComboboxValue>
			</ComboboxTrigger>
			<ComboboxContent>
				<ComboboxEmpty>No connections found.</ComboboxEmpty>
				<ComboboxList>
					{connections.map((connection: Connection) => (
						<ComboboxItem
							key={connection.connectionId}
							value={connection.connectionId}
						>
							{connection.name}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

// Server Search Preview - needs namespace for full functionality
export function ServerSearchPreview() {
	return (
		<PreviewFrame>
			<div className="p-4">
				<p className="text-sm text-muted-foreground mb-4">
					Try pasting{" "}
					<code className="bg-muted px-1 py-0.5 rounded text-xs">
						{DEFAULT_MCP_URL}
					</code>
				</p>
				<ServerSearch />
			</div>
		</PreviewFrame>
	);
}

// Connections Preview
export function ConnectionsPreview() {
	return (
		<PreviewFrame>
			<div className="h-[500px]">
				<Connections />
			</div>
		</PreviewFrame>
	);
}

// Tools Panel Preview - config OUTSIDE preview frame
export function ToolsPanelPreview() {
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<ToolsPanelInner connectionId={selectedConnectionIds[0] ?? null} />
			</PreviewFrame>
		</div>
	);
}

function ToolsPanelInner({ connectionId }: { connectionId: string | null }) {
	const { token, namespace } = useSmitheryContext();
	const { tools, isLoading, error, handleExecute } = useConnectionTools(
		token,
		connectionId,
		namespace,
	);

	if (!connectionId) {
		return (
			<div className="p-6 text-muted-foreground">
				Select a connection above.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-6 text-muted-foreground">
				<Spinner className="h-4 w-4" /> Loading tools...
			</div>
		);
	}

	if (error) {
		return <div className="p-6 text-destructive">Error: {error.message}</div>;
	}

	if (!tools || Object.keys(tools).length === 0) {
		return <div className="p-6 text-muted-foreground">No tools found.</div>;
	}

	return (
		<ConnectionConfigContext.Provider
			value={{
				mcpUrl: DEFAULT_MCP_URL,
				apiKey: token,
				namespace: namespace || "",
				connectionId,
			}}
		>
			<div className="h-[400px]">
				<ToolsPanel tools={tools} onExecute={handleExecute} />
			</div>
		</ConnectionConfigContext.Provider>
	);
}

// Tool Card Preview - config OUTSIDE preview frame
export function ToolCardPreview() {
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<ToolCardInner connectionId={selectedConnectionIds[0] ?? null} />
			</PreviewFrame>
		</div>
	);
}

function ToolCardInner({ connectionId }: { connectionId: string | null }) {
	const { token, namespace } = useSmitheryContext();
	const { tools, isLoading, error, handleExecute } = useConnectionTools(
		token,
		connectionId,
		namespace,
	);

	if (!connectionId) {
		return (
			<div className="p-6 text-muted-foreground">
				Select a connection above.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-6 text-muted-foreground">
				<Spinner className="h-4 w-4" /> Loading tools...
			</div>
		);
	}

	if (error) {
		return <div className="p-6 text-destructive">Error: {error.message}</div>;
	}

	if (!tools || Object.keys(tools).length === 0) {
		return <div className="p-6 text-muted-foreground">No tools found.</div>;
	}

	return (
		<ConnectionConfigContext.Provider
			value={{
				mcpUrl: DEFAULT_MCP_URL,
				apiKey: token,
				namespace: namespace || "",
				connectionId,
			}}
		>
			<div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
				{Object.entries(tools)
					.slice(0, 4)
					.map(([name, tool]) => (
						<ToolCard
							key={name}
							name={name}
							tool={tool}
							onExecute={(params) => handleExecute(name, params)}
						/>
					))}
			</div>
		</ConnectionConfigContext.Provider>
	);
}

// Tool Detail Dialog Preview - config OUTSIDE preview frame
export function ToolDetailDialogPreview() {
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<ToolDetailDialogInner
					connectionId={selectedConnectionIds[0] ?? null}
				/>
			</PreviewFrame>
		</div>
	);
}

function ToolDetailDialogInner({
	connectionId,
}: {
	connectionId: string | null;
}) {
	const { token, namespace } = useSmitheryContext();
	const { tools, isLoading, error, handleExecute } = useConnectionTools(
		token,
		connectionId,
		namespace,
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedToolName, setSelectedToolName] = useState<string | null>(null);

	if (!connectionId) {
		return (
			<div className="p-6 text-muted-foreground">
				Select a connection above.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-6 text-muted-foreground">
				<Spinner className="h-4 w-4" /> Loading tools...
			</div>
		);
	}

	if (error) {
		return <div className="p-6 text-destructive">Error: {error.message}</div>;
	}

	if (!tools || Object.keys(tools).length === 0) {
		return <div className="p-6 text-muted-foreground">No tools found.</div>;
	}

	const toolEntries = Object.entries(tools);
	const firstToolName = selectedToolName || toolEntries[0]?.[0];
	const firstTool = firstToolName ? tools[firstToolName] : null;

	return (
		<ConnectionConfigContext.Provider
			value={{
				mcpUrl: DEFAULT_MCP_URL,
				apiKey: token,
				namespace: namespace || "",
				connectionId,
			}}
		>
			<div className="p-4 space-y-4">
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Tool:</span>
					<Select
						value={firstToolName || ""}
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
					<Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
				</div>
				{firstTool && firstToolName && (
					<ToolDetailDialog
						open={dialogOpen}
						onOpenChange={setDialogOpen}
						name={firstToolName}
						tool={firstTool}
						onExecute={(params) => handleExecute(firstToolName, params)}
					/>
				)}
			</div>
		</ConnectionConfigContext.Provider>
	);
}

// Schema Form Preview - config OUTSIDE preview frame
export function SchemaFormPreview() {
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<SchemaFormInner connectionId={selectedConnectionIds[0] ?? null} />
			</PreviewFrame>
		</div>
	);
}

function SchemaFormInner({ connectionId }: { connectionId: string | null }) {
	const { token, namespace } = useSmitheryContext();
	const { tools, isLoading, error } = useConnectionTools(
		token,
		connectionId,
		namespace,
	);
	const [selectedToolName, setSelectedToolName] = useState<string | null>(null);

	const handleSubmit = (data: Record<string, unknown>) => {
		console.log("Form submitted:", data);
		alert(`Form submitted!\n\n${JSON.stringify(data, null, 2)}`);
	};

	if (!connectionId) {
		return (
			<div className="p-6 text-muted-foreground">
				Select a connection above.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-6 text-muted-foreground">
				<Spinner className="h-4 w-4" /> Loading tools...
			</div>
		);
	}

	if (error) {
		return <div className="p-6 text-destructive">Error: {error.message}</div>;
	}

	if (!tools || Object.keys(tools).length === 0) {
		return <div className="p-6 text-muted-foreground">No tools found.</div>;
	}

	const toolEntries = Object.entries(tools);
	const firstToolName = selectedToolName || toolEntries[0]?.[0];
	const firstTool = firstToolName ? tools[firstToolName] : null;

	if (!firstTool?.inputSchema) {
		return (
			<div className="p-6 text-muted-foreground">
				No tool with schema available.
			</div>
		);
	}

	return (
		<div className="p-4 space-y-4 max-w-md">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Tool schema:</span>
				<Select value={firstToolName || ""} onValueChange={setSelectedToolName}>
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
				<SchemaForm schema={firstTool.inputSchema} onSubmit={handleSubmit} />
			</div>
		</div>
	);
}

// Tool Search Preview - config OUTSIDE preview frame
export function ToolSearchPreview() {
	const { token, namespace } = useSmitheryContext();
	const [action, setAction] = useState("Create");
	const { data, isLoading, error } = useConnections(token, namespace);
	const [searchResults, setSearchResults] = useState<ToolSearchResult | null>(
		null,
	);

	if (isLoading) {
		return (
			<PreviewFrame>
				<div className="flex items-center gap-2 p-6 text-muted-foreground">
					<Spinner className="h-4 w-4" /> Loading...
				</div>
			</PreviewFrame>
		);
	}

	if (error) {
		return (
			<PreviewFrame>
				<div className="p-6 text-destructive">Error: {error.message}</div>
			</PreviewFrame>
		);
	}

	if (!data) {
		return (
			<PreviewFrame>
				<div className="p-6 text-muted-foreground">No connections found.</div>
			</PreviewFrame>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Action:</span>
				<Input
					value={action}
					onChange={(e) => setAction(e.target.value)}
					className="w-[280px]"
					placeholder="Enter action text"
				/>
				{searchResults && (
					<Dialog>
						<DialogTrigger asChild>
							<Button>Search Results</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[80vh] overflow-auto">
							<DialogTitle>Search Results</DialogTitle>
							<DialogDescription>
								Search results for the action: &quot;{action}&quot;
							</DialogDescription>
							<pre className="rounded-md bg-muted p-4 text-sm overflow-auto">
								{JSON.stringify(searchResults, null, 2)}
							</pre>
						</DialogContent>
					</Dialog>
				)}
			</div>
			<PreviewFrame>
				<div className="p-4">
					<ToolSearch
						defaultAction={action}
						connections={data.connections}
						onSearchComplete={setSearchResults}
					/>
				</div>
			</PreviewFrame>
		</div>
	);
}
