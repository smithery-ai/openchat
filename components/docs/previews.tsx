"use client";

import { createMCPClient } from "@ai-sdk/mcp";
import Smithery from "@smithery/api";
import { createConnection } from "@smithery/api/mcp";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { useQuery } from "@tanstack/react-query";
import type { ToolExecutionOptions } from "ai";
import { useAtomValue } from "jotai";
import { AlertCircle } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { listNamespaces } from "@/components/smithery/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Act } from "@/registry/new-york/smithery/act";
import { ConnectionConfigContext } from "@/registry/new-york/smithery/connection-context";
import { Connections } from "@/registry/new-york/smithery/connections";
import { SchemaForm } from "@/registry/new-york/smithery/schema-form";
import { ServerSearch } from "@/registry/new-york/smithery/server-search";
import { selectedTokenAtom } from "@/registry/new-york/smithery/tokens";
import { ToolCard } from "@/registry/new-york/smithery/tool-card";
import { ToolDetailDialog } from "@/registry/new-york/smithery/tool-detail-dialog";
import { ToolsPanel } from "@/registry/new-york/smithery/tools-panel";
import { PreviewFrame } from "./preview-frame";

const DEFAULT_MCP_URL = "https://mcp.exa.ai";

const getSmitheryClient = (token: string) => {
	return new Smithery({
		apiKey: token,
		baseURL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	});
};

// Uses server action to get namespace (scoped tokens lack namespaces:read)
async function getDefaultNamespace() {
	const namespaces = await listNamespaces();
	if (namespaces.length === 0) {
		throw new Error("No namespaces found");
	}
	return namespaces[0].name;
}

// Hook to get the default namespace
function useDefaultNamespace(token: string | undefined) {
	return useQuery({
		queryKey: ["defaultNamespace", token],
		queryFn: () => getDefaultNamespace(),
		enabled: !!token,
	});
}

function useConnections(token: string | undefined, namespace?: string) {
	return useQuery({
		queryKey: ["connections", token],
		queryFn: async () => {
			if (!token) throw new Error("Token required");
			const client = getSmitheryClient(token);
			const namespaceToUse = namespace || (await getDefaultNamespace());
			const { connections } =
				await client.beta.connect.connections.list(namespaceToUse);
			return { connections, namespace: namespaceToUse };
		},
		enabled: !!token,
	});
}

function useConnectionTools(
	token: string | undefined,
	connectionId: string | null,
	namespace?: string,
) {
	const clientQuery = useQuery({
		queryKey: ["mcp-client", token, connectionId, namespace],
		queryFn: async () => {
			if (!token || !connectionId)
				throw new Error("Token and connection required");
			const namespaceToUse = namespace || (await getDefaultNamespace());
			const { transport } = await createConnection({
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
	token,
	namespace,
	selectedConnectionIds,
	onSelectMultiple,
	multiple = false,
}: {
	token: string;
	namespace?: string;
	selectedConnectionIds: string[];
	onSelectMultiple: (connectionIds: string[]) => void;
	multiple?: boolean;
}) {
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

function TokenRequiredMessage() {
	return (
		<div className="p-6 text-muted-foreground text-center">
			Select a token above to view the preview.
		</div>
	);
}

// Server Search Preview - needs namespace for full functionality
export function ServerSearchPreview() {
	const apiKey = useAtomValue(selectedTokenAtom);
	const { data: namespace, isLoading: namespaceLoading } = useDefaultNamespace(
		apiKey?.token,
	);

	if (!apiKey) {
		return (
			<PreviewFrame>
				<TokenRequiredMessage />
			</PreviewFrame>
		);
	}

	if (namespaceLoading) {
		return (
			<PreviewFrame>
				<div className="flex items-center gap-2 p-6 text-muted-foreground">
					<Spinner className="h-4 w-4" /> Loading...
				</div>
			</PreviewFrame>
		);
	}
	
	if (!namespace) {
		return (
			<PreviewFrame>
				<div className="flex items-center gap-2 p-6 text-muted-foreground">
					<AlertCircle className="h-4 w-4" /> No namespace found.
				</div>
			</PreviewFrame>
		);
	}

	if (!namespace) {
		return (
			<PreviewFrame>
				<div className="flex items-center gap-2 p-6 text-muted-foreground">
					<AlertCircle className="h-4 w-4" /> No namespace found.
				</div>
			</PreviewFrame>
		);
	}

	return (
		<PreviewFrame>
			<div className="p-4">
				<p className="text-sm text-muted-foreground mb-4">
					Try pasting{" "}
					<code className="bg-muted px-1 py-0.5 rounded text-xs">
						{DEFAULT_MCP_URL}
					</code>
				</p>
				<ServerSearch token={apiKey.token} namespace={namespace} />
			</div>
		</PreviewFrame>
	);
}

// Connections Preview
export function ConnectionsPreview() {
	const apiKey = useAtomValue(selectedTokenAtom);
	const { data: namespace, isLoading: namespaceLoading } = useDefaultNamespace(
		apiKey?.token,
	);

	if (!apiKey) {
		return (
			<PreviewFrame>
				<TokenRequiredMessage />
			</PreviewFrame>
		);
	}

	if (namespaceLoading) {
		return (
			<PreviewFrame>
				<div className="flex items-center gap-2 p-6 text-muted-foreground">
					<Spinner className="h-4 w-4" /> Loading...
				</div>
			</PreviewFrame>
		);
	}

	return (
		<PreviewFrame>
			<div className="h-[500px]">
				<Connections token={apiKey.token} namespace={namespace} />
			</div>
		</PreviewFrame>
	);
}

// Tools Panel Preview - config OUTSIDE preview frame
export function ToolsPanelPreview() {
	const apiKey = useAtomValue(selectedTokenAtom);
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	if (!apiKey) {
		return (
			<PreviewFrame>
				<TokenRequiredMessage />
			</PreviewFrame>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					token={apiKey.token}
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<ToolsPanelInner
					token={apiKey.token}
					connectionId={selectedConnectionIds[0] ?? null}
				/>
			</PreviewFrame>
		</div>
	);
}

function ToolsPanelInner({
	token,
	connectionId,
}: {
	token: string;
	connectionId: string | null;
}) {
	const { tools, isLoading, error, handleExecute, namespace } =
		useConnectionTools(token, connectionId);

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
	const apiKey = useAtomValue(selectedTokenAtom);
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	if (!apiKey) {
		return (
			<PreviewFrame>
				<TokenRequiredMessage />
			</PreviewFrame>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					token={apiKey.token}
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<ToolCardInner
					token={apiKey.token}
					connectionId={selectedConnectionIds[0] ?? null}
				/>
			</PreviewFrame>
		</div>
	);
}

function ToolCardInner({
	token,
	connectionId,
}: {
	token: string;
	connectionId: string | null;
}) {
	const { tools, isLoading, error, handleExecute, namespace } =
		useConnectionTools(token, connectionId);

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
	const apiKey = useAtomValue(selectedTokenAtom);
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	if (!apiKey) {
		return (
			<PreviewFrame>
				<TokenRequiredMessage />
			</PreviewFrame>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					token={apiKey.token}
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<ToolDetailDialogInner
					token={apiKey.token}
					connectionId={selectedConnectionIds[0] ?? null}
				/>
			</PreviewFrame>
		</div>
	);
}

function ToolDetailDialogInner({
	token,
	connectionId,
}: {
	token: string;
	connectionId: string | null;
}) {
	const { tools, isLoading, error, handleExecute, namespace } =
		useConnectionTools(token, connectionId);
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
	const apiKey = useAtomValue(selectedTokenAtom);
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	if (!apiKey) {
		return (
			<PreviewFrame>
				<TokenRequiredMessage />
			</PreviewFrame>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					token={apiKey.token}
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
				/>
			</div>
			<PreviewFrame>
				<SchemaFormInner
					token={apiKey.token}
					connectionId={selectedConnectionIds[0] ?? null}
				/>
			</PreviewFrame>
		</div>
	);
}

function SchemaFormInner({
	token,
	connectionId,
}: {
	token: string;
	connectionId: string | null;
}) {
	const { tools, isLoading, error } = useConnectionTools(token, connectionId);
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

// Act Preview - config OUTSIDE preview frame
export function ActPreview() {
	const apiKey = useAtomValue(selectedTokenAtom);
	const [action, setAction] = useState("Approve tool execution");
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		[],
	);

	if (!apiKey) {
		return (
			<PreviewFrame>
				<TokenRequiredMessage />
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
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Connection:</span>
				<ConnectionSelector
					token={apiKey.token}
					selectedConnectionIds={selectedConnectionIds}
					onSelectMultiple={setSelectedConnectionIds}
					multiple={true}
				/>
			</div>
			<PreviewFrame>
				<ActInner
					token={apiKey.token}
					connectionIds={selectedConnectionIds}
					action={action}
				/>
			</PreviewFrame>
		</div>
	);
}

function ActInner({
	token,
	connectionIds,
	action,
}: {
	token: string;
	connectionIds: string[];
	action: string;
}) {
	const { data, isLoading } = useConnections(token);

	if (connectionIds.length === 0) {
		return (
			<div className="p-6 text-muted-foreground">
				Select a connection above.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-6 text-muted-foreground">
				<Spinner className="h-4 w-4" /> Loading...
			</div>
		);
	}

	const selectedConnections = data?.connections.filter((c) =>
		connectionIds.includes(c.connectionId),
	);

	if (!selectedConnections?.length || !data?.namespace) {
		return (
			<div className="p-6 text-muted-foreground">Connection not found.</div>
		);
	}

	return (
		<div className="p-4">
			<Act
				action={action}
				connections={selectedConnections}
				namespace={data.namespace}
				apiKey={token}
			/>
		</div>
	);
}
