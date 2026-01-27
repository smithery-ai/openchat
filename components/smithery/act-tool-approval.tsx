"use client";

import type { Connection } from "@smithery/api/resources/beta/connect/connections";
import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Check, ChevronDown, Loader2, Plus, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getConnections, listNamespaces, planAction, runTool } from "./actions";
import type { ConnectionConfig, ToolCallTemplate } from "./types";

export type ActToolApprovalProps = {
	prompt: string;
	configId: string;
	namespace?: string;
	initialConnectionIds?: string[];
	onExecute: (prompt: string, connectionIds: string[], result: unknown) => void;
	onReject: () => void;
	apiKey?: string | null;
};

type ConnectionPoolDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	namespace: string;
	selectedIds: string[];
	onConfirm: (connectionIds: string[]) => void;
	apiKey?: string | null;
};

function ConnectionPoolDialog({
	open,
	onOpenChange,
	namespace,
	selectedIds,
	onConfirm,
	apiKey,
}: ConnectionPoolDialogProps) {
	const [connections, setConnections] = useState<Connection[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState({});

	const loadConnections = useCallback(async () => {
		if (!namespace) {
			console.warn("ConnectionPoolDialog: No namespace provided");
			return;
		}

		console.log(
			"ConnectionPoolDialog: Loading connections for namespace:",
			namespace,
		);
		setIsLoading(true);
		setError(null);
		try {
			const data = await getConnections(namespace, apiKey);
			console.log("ConnectionPoolDialog: Loaded connections:", data);
			setConnections(data);
		} catch (err) {
			console.error("ConnectionPoolDialog: Failed to load connections:", err);
			setError(
				err instanceof Error ? err.message : "Failed to load connections",
			);
		} finally {
			setIsLoading(false);
		}
	}, [namespace, apiKey]);

	useEffect(() => {
		if (open) {
			loadConnections();
		}
	}, [open, loadConnections]);

	// Set initial row selection based on selectedIds
	useEffect(() => {
		if (connections.length > 0 && selectedIds.length > 0) {
			const selection: Record<string, boolean> = {};
			connections.forEach((conn, index) => {
				if (selectedIds.includes(conn.connectionId)) {
					selection[index.toString()] = true;
				}
			});
			setRowSelection(selection);
		}
	}, [connections, selectedIds]);

	const columns: ColumnDef<Connection>[] = [
		{
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => (
				<div className="flex items-center gap-2">
					{row.original.iconUrl ? (
						<img
							src={row.original.iconUrl}
							alt=""
							className="size-4 rounded shrink-0"
						/>
					) : (
						<div className="size-4 rounded bg-muted shrink-0" />
					)}
					<span className="font-medium">{row.getValue("name")}</span>
				</div>
			),
		},
		{
			accessorKey: "connectionId",
			header: "Connection ID",
			cell: ({ row }) => (
				<div className="text-muted-foreground text-xs max-w-xs truncate">
					{row.getValue("connectionId")}
				</div>
			),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				const status = row.original.status;
				const variant =
					status?.state === "connected"
						? "default"
						: status?.state === "error"
							? "destructive"
							: "outline";
				return <Badge variant={variant}>{status?.state || "unknown"}</Badge>;
			},
		},
	];

	const table = useReactTable({
		data: connections,
		columns,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			columnFilters,
			rowSelection,
		},
	});

	const handleConfirm = () => {
		const selectedRows = table.getFilteredSelectedRowModel().rows;
		const selectedConnectionIds = selectedRows.map(
			(row) => row.original.connectionId,
		);
		onConfirm(selectedConnectionIds);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Add from Connection Pool</DialogTitle>
					<DialogDescription>
						Select connections to add to this approval request.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 flex-1 min-h-0 flex flex-col">
					<Input
						placeholder="Filter by name..."
						value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
						onChange={(event) =>
							table.getColumn("name")?.setFilterValue(event.target.value)
						}
						className="max-w-sm"
					/>

					{error && (
						<Alert variant="destructive">
							<div className="text-sm">{error}</div>
						</Alert>
					)}

					{isLoading ? (
						<div className="flex justify-center py-8">Loading...</div>
					) : (
						<div className="flex-1 min-h-0 overflow-auto border rounded-md">
							<Table>
								<TableHeader>
									{table.getHeaderGroups().map((headerGroup) => (
										<TableRow key={headerGroup.id}>
											{headerGroup.headers.map((header) => (
												<TableHead key={header.id}>
													{header.isPlaceholder
														? null
														: flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)}
												</TableHead>
											))}
										</TableRow>
									))}
								</TableHeader>
								<TableBody>
									{table.getRowModel().rows?.length ? (
										table.getRowModel().rows.map((row) => (
											<TableRow
												key={row.id}
												data-state={row.getIsSelected() && "selected"}
											>
												{row.getVisibleCells().map((cell) => (
													<TableCell key={cell.id}>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												))}
											</TableRow>
										))
									) : (
										<TableRow>
											<TableCell
												colSpan={columns.length}
												className="h-24 text-center"
											>
												No connections found.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
					)}

					<div className="flex items-center justify-between pt-4 border-t">
						<div className="text-muted-foreground text-sm">
							{table.getFilteredSelectedRowModel().rows.length} connection(s)
							selected
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button onClick={handleConfirm}>Confirm Selection</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function ActToolApproval({
	prompt,
	configId,
	namespace: providedNamespace,
	initialConnectionIds = [],
	onExecute,
	onReject,
	apiKey,
}: ActToolApprovalProps) {
	const [promptValue, setPromptValue] = useState(prompt);
	const [selectedConnectionIds, setSelectedConnectionIds] =
		useState<string[]>(initialConnectionIds);
	const [selectedConnections, setSelectedConnections] = useState<Connection[]>(
		[],
	);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isLoadingConnections, setIsLoadingConnections] = useState(false);
	const [isInitializing, setIsInitializing] = useState(
		initialConnectionIds.length > 0,
	);
	const [namespace, setNamespace] = useState<string>("");
	const [planResult, setPlanResult] = useState<ToolCallTemplate | null>(null);
	const [isPlanLoading, setIsPlanLoading] = useState(false);
	const [planError, setPlanError] = useState<string | null>(null);
	const [isPlanStale, setIsPlanStale] = useState(true); // Track if plan needs refresh
	const [finalState, setFinalState] = useState<"approved" | "rejected" | null>(
		null,
	);
	const [isRunning, setIsRunning] = useState(false);
	const [toolOutput, setToolOutput] = useState<unknown>(null);

	// Load namespace if not provided
	useEffect(() => {
		const loadDefaultNamespace = async () => {
			if (providedNamespace) {
				console.log("Using provided namespace:", providedNamespace);
				setNamespace(providedNamespace);
				return;
			}

			try {
				const namespaces = await listNamespaces();
				console.log("Loaded namespaces:", namespaces);
				if (namespaces.length > 0) {
					console.log("Setting default namespace:", namespaces[0].name);
					setNamespace(namespaces[0].name);
				} else {
					console.warn("No namespaces found");
				}
			} catch (err) {
				console.error("Failed to load namespaces:", err);
			}
		};

		loadDefaultNamespace();
	}, [providedNamespace, apiKey]);

	// Load full connection details when IDs change
	useEffect(() => {
		const loadSelectedConnections = async () => {
			if (selectedConnectionIds.length === 0) {
				setSelectedConnections([]);
				setIsInitializing(false);
				return;
			}

			if (!namespace) {
				console.warn("Cannot load connections: namespace not set");
				return;
			}

			console.log(
				"Loading connections for namespace:",
				namespace,
				"IDs:",
				selectedConnectionIds,
			);
			setIsLoadingConnections(true);
			try {
				const allConnections = await getConnections(namespace, apiKey);
				console.log("All connections:", allConnections);
				const selected = allConnections.filter((conn) =>
					selectedConnectionIds.includes(conn.connectionId),
				);
				console.log("Selected connections:", selected);
				setSelectedConnections(selected);
			} catch (err) {
				console.error("Failed to load connection details:", err);
			} finally {
				setIsLoadingConnections(false);
				setIsInitializing(false);
			}
		};

		loadSelectedConnections();
	}, [selectedConnectionIds, namespace, apiKey]);

	// Function to run the plan
	const runPlan = useCallback(async () => {
		if (!promptValue.trim() || selectedConnections.length === 0) {
			console.log("Skipping plan: missing prompt or connections");
			return;
		}

		console.log("Running plan with:", {
			prompt: promptValue,
			connections: selectedConnections,
		});
		setIsPlanLoading(true);
		setPlanError(null);
		try {
			const connectionConfigs: ConnectionConfig[] = selectedConnections.map(
				(conn) => ({
					serverUrl: conn.mcpUrl,
					configId: conn.connectionId,
				}),
			);
			const result = await planAction(promptValue, connectionConfigs, apiKey);
			console.log("Plan result:", result);
			setPlanResult(result.output);
			setIsPlanStale(false);
		} catch (err) {
			console.error("Failed to run plan:", err);
			setPlanError(err instanceof Error ? err.message : "Failed to run plan");
		} finally {
			setIsPlanLoading(false);
		}
	}, [promptValue, selectedConnections, apiKey]);

	// Auto-run preview on mount once connections are loaded
	useEffect(() => {
		if (
			selectedConnections.length > 0 &&
			promptValue.trim() &&
			!planResult &&
			!isPlanLoading &&
			isPlanStale
		) {
			runPlan();
		}
	}, [
		selectedConnections,
		promptValue,
		planResult,
		isPlanLoading,
		isPlanStale,
		runPlan,
	]);

	const handleRemoveConnection = (connectionId: string) => {
		setSelectedConnectionIds((prev) =>
			prev.filter((id) => id !== connectionId),
		);
		setIsPlanStale(true);
	};

	const handlePromptChange = (value: string) => {
		setPromptValue(value);
		setIsPlanStale(true);
	};

	const handleConnectionsChange = (connectionIds: string[]) => {
		setSelectedConnectionIds(connectionIds);
		setIsPlanStale(true);
	};

	const handleApprove = async () => {
		if (!planResult || !namespace) {
			console.error("Cannot execute: missing plan result or namespace");
			return;
		}

		console.log("Executing tool", {
			prompt: promptValue,
			connectionIds: selectedConnectionIds,
			configId,
			namespace,
			toolName: planResult.toolName,
			args: planResult.argsTemplate,
		});

		setFinalState("approved");
		setIsRunning(true);

		try {
			// Execute the tool using configId from the plan result
			const result = await runTool(
				planResult.server.configId,
				namespace,
				planResult.toolName,
				planResult.argsTemplate,
				apiKey,
			);

			console.log("Tool execution result:", result);
			setToolOutput(result);
			setIsRunning(false);
			onExecute(promptValue, selectedConnectionIds, result);
		} catch (error) {
			console.error("Tool execution failed:", error);
			setToolOutput(
				error instanceof Error ? error.message : "Tool execution failed",
			);
			setIsRunning(false);
		}
	};

	const handleReject = () => {
		console.log("Reject clicked", { configId, namespace });
		setFinalState("rejected");
		onReject();
	};

	// Final state view after approve/reject
	if (finalState) {
		const serverDisplay = (() => {
			if (!planResult) return null;
			const url = planResult.server.serverUrl;
			const match = url.match(/server\.smithery\.ai\/([^/]+)/);
			if (match) {
				const serverName = match[1];
				// Try to find connection by configId first, fall back to URL matching
				const conn =
					selectedConnections.find(
						(c) => c.connectionId === planResult.server.configId,
					) || selectedConnections.find((c) => c.mcpUrl.includes(serverName));
				return (
					<Badge variant="secondary" className="gap-1">
						{conn?.iconUrl && (
							<img src={conn.iconUrl} alt="" className="size-3 rounded" />
						)}
						{serverName}
					</Badge>
				);
			}
			return (
				<span className="text-xs text-muted-foreground font-mono">{url}</span>
			);
		})();

		return (
			<div className="p-4 border rounded-lg space-y-3">
				<div className="flex items-center gap-2">
					{finalState === "approved" ? (
						isRunning ? (
							<>
								<Loader2 className="size-4 text-blue-600 animate-spin" />
								<span className="text-sm font-medium text-blue-600">
									Running
								</span>
							</>
						) : (
							<>
								<Check className="size-4 text-green-600" />
								<span className="text-sm font-medium text-green-600">
									Completed
								</span>
							</>
						)
					) : (
						<>
							<XCircle className="size-4 text-muted-foreground" />
							<span className="text-sm font-medium text-muted-foreground">
								Rejected
							</span>
						</>
					)}
				</div>

				{planResult && (
					<div className="flex items-center gap-2 flex-wrap text-sm">
						<span className="font-mono font-medium">{planResult.toolName}</span>
						<span className="text-muted-foreground">@</span>
						{serverDisplay}
					</div>
				)}

				<div className="text-xs text-muted-foreground">{promptValue}</div>

				{planResult && (
					<Collapsible>
						<CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
							<ChevronDown className="size-3" />
							Arguments
						</CollapsibleTrigger>
						<CollapsibleContent>
							<pre className="text-xs font-mono bg-muted/50 p-2 rounded border overflow-x-auto mt-1">
								{JSON.stringify(planResult.argsTemplate, null, 2)}
							</pre>
						</CollapsibleContent>
					</Collapsible>
				)}

				{toolOutput !== null && (
					<Collapsible>
						<CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
							<ChevronDown className="size-3" />
							Output
						</CollapsibleTrigger>
						<CollapsibleContent>
							<pre className="text-xs font-mono bg-muted/50 p-2 rounded border overflow-x-auto mt-1 max-h-60 overflow-y-auto">
								{(() => {
									if (typeof toolOutput === "string") {
										return toolOutput;
									}
									try {
										return JSON.stringify(toolOutput, null, 2);
									} catch {
										return String(toolOutput);
									}
								})()}
							</pre>
						</CollapsibleContent>
					</Collapsible>
				)}
			</div>
		);
	}

	// Show loading state while initializing with initial connections
	if (isInitializing) {
		return (
			<div className="space-y-4 p-4 border rounded-lg">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Loading connections...
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4 p-4 border rounded-lg">
			<div className="space-y-2">
				<label htmlFor="prompt" className="text-sm font-medium">
					Prompt Configuration
				</label>
				<Textarea
					id="prompt"
					value={promptValue}
					onChange={(e) => handlePromptChange(e.target.value)}
					className="min-h-[60px]"
					placeholder="Enter approval prompt..."
				/>
			</div>

			<div className="flex items-center gap-2 flex-wrap">
				<span className="text-sm text-muted-foreground">Connections:</span>
				{isLoadingConnections ? (
					<span className="text-sm text-muted-foreground">Loading...</span>
				) : (
					selectedConnections.map((conn) => (
						<Badge
							key={conn.connectionId}
							variant="secondary"
							className="gap-1 pr-1"
						>
							{conn.iconUrl ? (
								<img
									src={conn.iconUrl}
									alt=""
									className="size-3 rounded shrink-0"
								/>
							) : (
								<div className="size-3 rounded bg-muted shrink-0" />
							)}
							{conn.name}
							<button
								type="button"
								onClick={() => handleRemoveConnection(conn.connectionId)}
								className="ml-1 hover:bg-muted rounded"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))
				)}
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsDialogOpen(true)}
					className="h-6 px-2"
				>
					<Plus className="size-3 mr-1" />
					Add
				</Button>
			</div>

			{/* Plan Result Section */}
			{isPlanLoading ? (
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Generating plan...
				</div>
			) : planError ? (
				<Alert variant="destructive">
					<div className="text-sm">{planError}</div>
				</Alert>
			) : planResult ? (
				<div className="p-3 border rounded-md bg-muted/50 space-y-2">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-sm font-mono font-medium">
							{planResult.toolName}
						</span>
						<span className="text-muted-foreground">@</span>
						{(() => {
							// Extract server name from URL for known servers
							const url = planResult.server.serverUrl;
							const match = url.match(/server\.smithery\.ai\/([^/]+)/);
							if (match) {
								const serverName = match[1];
								// Find matching connection by configId first, fall back to URL matching
								const conn =
									selectedConnections.find(
										(c) => c.connectionId === planResult.server.configId,
									) ||
									selectedConnections.find((c) =>
										c.mcpUrl.includes(serverName),
									);
								return (
									<Badge variant="secondary" className="gap-1">
										{conn?.iconUrl && (
											<img
												src={conn.iconUrl}
												alt=""
												className="size-3 rounded"
											/>
										)}
										{serverName}
									</Badge>
								);
							}
							// Fallback to full URL
							return (
								<span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
									{url}
								</span>
							);
						})()}
					</div>
					<Collapsible>
						<CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
							<ChevronDown className="size-3" />
							Arguments
						</CollapsibleTrigger>
						<CollapsibleContent>
							<pre className="text-xs font-mono bg-background p-2 rounded border overflow-x-auto mt-1">
								{JSON.stringify(planResult.argsTemplate, null, 2)}
							</pre>
						</CollapsibleContent>
					</Collapsible>
				</div>
			) : (
				<div className="text-sm text-muted-foreground">
					No plan yet. Click "Preview" to generate.
				</div>
			)}

			<div className="flex gap-2 justify-end pt-4 border-t">
				<Button
					variant="outline"
					onClick={handleReject}
					disabled={isLoadingConnections || isPlanLoading}
				>
					Reject
				</Button>
				<Button
					onClick={isPlanStale ? runPlan : handleApprove}
					disabled={
						isLoadingConnections ||
						isPlanLoading ||
						!promptValue.trim() ||
						selectedConnectionIds.length === 0
					}
				>
					{isPlanLoading ? (
						<>
							<Loader2 className="size-4 mr-1 animate-spin" />
							Generating...
						</>
					) : isPlanStale ? (
						"Preview"
					) : (
						"Approve"
					)}
				</Button>
			</div>

			<ConnectionPoolDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				namespace={namespace}
				selectedIds={selectedConnectionIds}
				onConfirm={handleConnectionsChange}
				apiKey={apiKey}
			/>
		</div>
	);
}
