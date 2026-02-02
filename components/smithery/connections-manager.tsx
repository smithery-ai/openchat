"use client";

import type { Connection } from "@smithery/api/resources/experimental/connect/connections";
import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, Info, MoreHorizontal, Trash2 } from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteConnection, getConnections, listNamespaces } from "./actions";

export type ConnectionActionContext = {
	namespace: string;
};

export type ConnectionAction = {
	name: string;
	icon?: React.ReactNode;
	onClick: (
		connection: Connection,
		context: ConnectionActionContext,
	) => void | Promise<void>;
	variant?: "default" | "destructive";
};

type ConnectionsManagerProps = {
	actions?: ConnectionAction[];
	apiKey?: string | null;
};

type ActionExecutionState = {
	connectionId: string;
	actionName: string;
};

function getStatusVariant(
	status?: Connection["status"],
): "default" | "destructive" | "outline" {
	if (!status) return "outline";

	switch (status.state) {
		case "connected":
			return "default";
		case "error":
			return "destructive";
		case "auth_required":
			return "outline";
		default:
			return "outline";
	}
}

function formatDate(isoString?: string): string {
	if (!isoString) return "Unknown";

	const date = new Date(isoString);
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

type ActionMenuItemProps = {
	action: ConnectionAction;
	connection: Connection;
	onExecute: (
		connection: Connection,
		action: ConnectionAction,
	) => Promise<void>;
	isExecuting: boolean;
};

function ActionMenuItem({
	action,
	connection,
	onExecute,
	isExecuting,
}: ActionMenuItemProps) {
	const handleClick = async () => {
		await onExecute(connection, action);
	};

	return (
		<DropdownMenuItem onClick={handleClick} disabled={isExecuting}>
			{action.icon && <span className="mr-2">{action.icon}</span>}
			{isExecuting ? `${action.name}...` : action.name}
		</DropdownMenuItem>
	);
}

type DeleteDialogProps = {
	connection: Connection;
	onDelete: (id: string) => Promise<void>;
	isDeleting: boolean;
};

async function* deleteWithConcurrency(
	connectionIds: string[],
	namespace: string,
	apiKey: string | null | undefined,
	maxConcurrency = 3,
): AsyncGenerator<
	{ completed: number; total: number; currentId: string },
	void,
	unknown
> {
	let completed = 0;
	const total = connectionIds.length;
	const executing: Promise<string>[] = [];

	for (const id of connectionIds) {
		// Wrap deletion in a promise that removes itself when done
		const promise = deleteConnection(id, namespace, apiKey).then(() => {
			executing.splice(executing.indexOf(promise), 1);
			return id;
		});

		executing.push(promise);

		// Wait when pool is full
		if (executing.length >= maxConcurrency) {
			const completedId = await Promise.race(executing);
			completed++;
			yield { completed, total, currentId: completedId };
		}
	}

	// Process remaining
	while (executing.length > 0) {
		const completedId = await Promise.race(executing);
		completed++;
		yield { completed, total, currentId: completedId };
	}
}

function DeleteDialog({ connection, onDelete, isDeleting }: DeleteDialogProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
					<Trash2 className="size-4" />
					Delete
				</DropdownMenuItem>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete connection?</AlertDialogTitle>
					<AlertDialogDescription>
						This will remove "{connection.name}". This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => onDelete(connection.connectionId)}
						disabled={isDeleting}
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

type DeleteSelectedDialogProps = {
	selectedCount: number;
	onConfirm: () => void;
	isDeleting: boolean;
	progress: { completed: number; total: number } | null;
};

function DeleteSelectedDialog({
	selectedCount,
	onConfirm,
	isDeleting,
	progress,
}: DeleteSelectedDialogProps) {
	const [open, setOpen] = useState(false);

	const handleConfirm = () => {
		setOpen(false);
		onConfirm();
	};

	if (selectedCount === 0) return null;

	const buttonText =
		isDeleting && progress
			? `Deleting ${progress.completed} of ${progress.total}...`
			: `Delete ${selectedCount} selected`;

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button variant="destructive" size="sm" disabled={isDeleting}>
					<Trash2 className="size-4" />
					{buttonText}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete selected connections?</AlertDialogTitle>
					<AlertDialogDescription>
						This will remove {selectedCount} selected connections. This action
						cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={handleConfirm}>Delete</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export const ConnectionsManager = ({
	actions,
	apiKey,
}: ConnectionsManagerProps = {}) => {
	const [connections, setConnections] = useState<Connection[]>([]);
	const [namespaces, setNamespaces] = useState<
		Array<{ name: string; createdAt: string }>
	>([]);
	const [selectedNamespace, setSelectedNamespace] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{
		completed: number;
		total: number;
	} | null>(null);
	const [executingAction, setExecutingAction] =
		useState<ActionExecutionState | null>(null);

	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});

	const loadNamespaces = useCallback(async () => {
		try {
			const data = await listNamespaces();
			setNamespaces(data);
			if (data.length > 0 && !selectedNamespace) {
				setSelectedNamespace(data[0].name);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load namespaces",
			);
		}
	}, [selectedNamespace]);

	const loadConnections = useCallback(async () => {
		if (!selectedNamespace) return;

		setIsLoading(true);
		setError(null);
		try {
			const data = await getConnections(selectedNamespace, apiKey);
			setConnections(data);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load connections",
			);
		} finally {
			setIsLoading(false);
		}
	}, [selectedNamespace, apiKey]);

	useEffect(() => {
		loadNamespaces();
	}, [loadNamespaces]);

	useEffect(() => {
		loadConnections();
	}, [loadConnections]);

	const handleDelete = async (connectionId: string) => {
		if (!selectedNamespace) return;

		setDeletingId(connectionId);
		try {
			await deleteConnection(connectionId, selectedNamespace, apiKey);
			setConnections((prev) =>
				prev.filter((conn) => conn.connectionId !== connectionId),
			);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to delete connection",
			);
		} finally {
			setDeletingId(null);
		}
	};

	const handleActionExecute = async (
		connection: Connection,
		action: ConnectionAction,
	) => {
		setExecutingAction({
			connectionId: connection.connectionId,
			actionName: action.name,
		});

		try {
			await action.onClick(connection, { namespace: selectedNamespace });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed");
		} finally {
			setExecutingAction(null);
		}
	};

	const handleDeleteSelected = async () => {
		if (!selectedNamespace) return;

		const selectedRows = table.getFilteredSelectedRowModel().rows;
		const idsToDelete = selectedRows.map((row) => row.original.connectionId);

		if (idsToDelete.length === 0) return;

		setBulkDeleteProgress({ completed: 0, total: idsToDelete.length });
		setError(null);

		// Clear selection
		table.resetRowSelection();

		try {
			for await (const progress of deleteWithConcurrency(
				idsToDelete,
				selectedNamespace,
				apiKey,
				3,
			)) {
				setBulkDeleteProgress(progress);
				// Remove completed connection from UI
				setConnections((prev) =>
					prev.filter((conn) => conn.connectionId !== progress.currentId),
				);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to delete connections",
			);
			// Reload connections on error to restore actual state
			await loadConnections();
		} finally {
			setBulkDeleteProgress(null);
		}
	};

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
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Name
						<ArrowUpDown />
					</Button>
				);
			},
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
				return (
					<Badge variant={getStatusVariant(status)}>
						{status?.state || "unknown"}
					</Badge>
				);
			},
		},
		{
			accessorKey: "metadata",
			header: "Metadata",
			cell: ({ row }) => {
				const metadata = row.original.metadata;
				if (!metadata || Object.keys(metadata).length === 0) {
					return <span className="text-muted-foreground text-xs">—</span>;
				}

				return (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
								>
									<Info className="size-3" />
									<span>{Object.keys(metadata).length} properties</span>
								</button>
							</TooltipTrigger>
							<TooltipContent side="left" className="max-w-md">
								<pre className="text-xs">
									{JSON.stringify(metadata, null, 2)}
								</pre>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				);
			},
		},
		{
			accessorKey: "createdAt",
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Created
						<ArrowUpDown />
					</Button>
				);
			},
			cell: ({ row }) => (
				<div className="text-muted-foreground text-xs">
					{formatDate(row.getValue("createdAt"))}
				</div>
			),
		},
		{
			id: "actions",
			enableHiding: false,
			cell: ({ row }) => {
				const connection = row.original;

				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<span className="sr-only">Open menu</span>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{actions && actions.length > 0 && (
								<DropdownMenuGroup>
									<DropdownMenuLabel>Actions</DropdownMenuLabel>
									{actions.map((action) => (
										<ActionMenuItem
											key={`${connection.connectionId}-${action.name}`}
											action={action}
											connection={connection}
											onExecute={handleActionExecute}
											isExecuting={
												executingAction?.connectionId ===
													connection.connectionId &&
												executingAction?.actionName === action.name
											}
										/>
									))}
								</DropdownMenuGroup>
							)}
							<DropdownMenuGroup>
								<DropdownMenuLabel>Default Actions</DropdownMenuLabel>
								<DropdownMenuItem
									onClick={() =>
										navigator.clipboard.writeText(connection.connectionId)
									}
								>
									Copy connection ID
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										navigator.clipboard.writeText(connection.mcpUrl)
									}
								>
									Copy MCP URL
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuGroup>
								<DeleteDialog
									connection={connection}
									onDelete={handleDelete}
									isDeleting={deletingId === connection.connectionId}
								/>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];

	const table = useReactTable({
		data: connections,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	});

	if (isLoading) {
		return (
			<div className="flex justify-center py-8">
				<Spinner />
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<div className="text-sm">{error}</div>
			</Alert>
		);
	}

	if (connections.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>No connections</EmptyTitle>
					<EmptyDescription>
						You haven't connected to any MCP servers yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="w-full">
			<div className="flex items-center gap-2 py-4">
				<Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
					<SelectTrigger size="sm" className="w-[180px]">
						<SelectValue placeholder="Select namespace" />
					</SelectTrigger>
					<SelectContent>
						{namespaces.map((ns) => (
							<SelectItem key={ns.name} value={ns.name}>
								{ns.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					placeholder="Filter by name..."
					value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
					onChange={(event) =>
						table.getColumn("name")?.setFilterValue(event.target.value)
					}
					className="max-w-sm"
				/>
			</div>
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									);
								})}
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
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-end space-x-2 py-4">
				<div className="text-muted-foreground flex-1 text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of{" "}
					{table.getFilteredRowModel().rows.length} row(s) selected.
				</div>
				<DeleteSelectedDialog
					selectedCount={table.getFilteredSelectedRowModel().rows.length}
					onConfirm={handleDeleteSelected}
					isDeleting={bulkDeleteProgress !== null}
					progress={bulkDeleteProgress}
				/>
				<div className="space-x-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
};

export function ConnectionsDialog({
	children,
	actions,
	apiKey,
}: {
	children: React.ReactNode;
	actions?: ConnectionAction[];
	apiKey?: string | null;
}) {
	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="!max-w-[90vw] h-[80vh] overflow-hidden flex flex-col gap-4 p-6">
				<DialogHeader className="shrink-0">
					<DialogTitle>Manage Connections</DialogTitle>
					<DialogDescription>
						View and manage your MCP server connections.
					</DialogDescription>
				</DialogHeader>
				<div className="flex-1 min-h-0 -mx-6">
					<ScrollArea className="h-full px-6">
						<ConnectionsManager actions={actions} apiKey={apiKey} />
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	);
}
