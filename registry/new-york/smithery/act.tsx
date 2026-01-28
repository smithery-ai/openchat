"use client";

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Connection } from "@smithery/api/resources/beta/connect/connections";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Combobox,
	ComboboxChip,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
} from "@/components/ui/combobox";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export function Act({
	defaultAction,
	connections,
	namespace,
	apiKey,
}: {
	defaultAction: string;
	connections: Connection[];
	namespace: string;
	apiKey: string;
}) {
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
		connections.map((connection: Connection) => connection.connectionId),
	);
	const [inputValue, setInputValue] = useState("");
	const [action, setAction] = useState(defaultAction);
	const [isEditingAction, setIsEditingAction] = useState(false);
	const [isEditingConnections, setIsEditingConnections] = useState(false);

	const selectedConnections = connections.filter((connection: Connection) =>
		selectedConnectionIds.includes(connection.connectionId),
	);

	const { data, isLoading, isFetching, refetch } = useQuery({
		queryKey: ["tool-search", namespace, apiKey],
		queryFn: async () => {
			const response = await fetch("/api/tool-search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					connections: selectedConnections,
					apiKey,
					namespace,
					action,
				}),
			});
			return response.json() satisfies Promise<{
				searchResults: Tool[];
			}>;
		},
		enabled: false,
	});

	const connectionIds = connections.map(
		(connection: Connection) => connection.connectionId,
	);

	const handleSelectionChange = (ids: string[] | null) => {
		setSelectedConnectionIds(ids ?? []);
	};

	const getConnectionById = (id: string) =>
		connections.find(
			(connection: Connection) => connection.connectionId === id,
		);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-1.5 text-lg">
				<span className="text-muted-foreground">Searching for</span>

				{/* Action - editable inline */}
				<Popover open={isEditingAction} onOpenChange={setIsEditingAction}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="rounded-md bg-muted px-2 py-0.5 hover:bg-muted/80 transition-colors"
						>
							{action || "action"}
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-64 p-2" align="start">
						<Input
							value={action}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								setAction(e.target.value)
							}
							placeholder="Enter action..."
							className="h-8"
							autoFocus
							onKeyDown={(e: React.KeyboardEvent) => {
								if (e.key === "Enter") {
									setIsEditingAction(false);
								}
							}}
						/>
					</PopoverContent>
				</Popover>

				<span className="text-muted-foreground">from</span>

				{/* Connections - chips with popover for editing */}
				<Popover
					open={isEditingConnections}
					onOpenChange={setIsEditingConnections}
				>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="inline-flex flex-wrap items-center gap-1 rounded-md hover:bg-muted/50 transition-colors px-1 py-0.5"
						>
							{selectedConnections.length > 0 ? (
								selectedConnections.map((connection) => (
									<span
										key={connection.connectionId}
										className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-sm font-medium"
									>
										<Avatar className="size-3 rounded-sm">
											<AvatarImage
												src={connection.iconUrl ?? ""}
												alt={connection.name ?? ""}
											/>
											<AvatarFallback className="rounded-sm bg-background text-[8px]">
												{connection.name?.charAt(0) ?? ""}
											</AvatarFallback>
										</Avatar>
										{connection.name}
									</span>
								))
							) : (
								<span className="rounded-md bg-muted px-2 py-0.5 font-medium">
									select connections
								</span>
							)}
						</button>
					</PopoverTrigger>
					<PopoverContent className="w-72 p-2" align="start">
						<Combobox
							multiple
							autoHighlight
							items={connectionIds}
							value={selectedConnectionIds}
							onValueChange={handleSelectionChange}
						>
							<div className="flex flex-wrap items-center gap-1 rounded-md border bg-background p-1.5">
								<ComboboxValue>
									{(values) => (
										<Fragment>
											{values.map((id: string) => {
												const connection = getConnectionById(id);
												return (
													<ComboboxChip key={id}>
														<Avatar className="size-3 rounded-sm">
															<AvatarImage
																src={connection?.iconUrl ?? ""}
																alt={connection?.name ?? ""}
															/>
															<AvatarFallback className="rounded-sm bg-muted text-[8px]">
																{connection?.name?.charAt(0) ?? ""}
															</AvatarFallback>
														</Avatar>
														{connection?.name ?? id}
													</ComboboxChip>
												);
											})}
											<ComboboxChipsInput
												placeholder={
													values.length === 0 ? "Select connections..." : ""
												}
												value={inputValue}
												onChange={(e) => setInputValue(e.target.value)}
												className="flex-1 min-w-[100px]"
											/>
										</Fragment>
									)}
								</ComboboxValue>
							</div>
							<ComboboxContent>
								<ComboboxEmpty>No connections found.</ComboboxEmpty>
								<ComboboxList>
									{(id) => {
										const connection = getConnectionById(id);
										return (
											<ComboboxItem key={id} value={id}>
												<Item size="sm" className="p-0 min-w-0">
													<ItemMedia>
														<Avatar className="h-8 w-8 rounded-md">
															<AvatarImage
																src={connection?.iconUrl ?? ""}
																alt={connection?.name ?? ""}
															/>
															<AvatarFallback className="rounded-md bg-muted">
																{connection?.name?.charAt(0) ?? ""}
															</AvatarFallback>
														</Avatar>
													</ItemMedia>
													<ItemContent className="min-w-0">
														<ItemTitle className="w-full truncate">
															{connection?.name ?? id}
														</ItemTitle>
														<ItemDescription className="line-clamp-1">
															{connection?.connectionId || "No ID"}
														</ItemDescription>
													</ItemContent>
												</Item>
											</ComboboxItem>
										);
									}}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					</PopoverContent>
				</Popover>
			</div>

			<Button type="button" onClick={() => refetch()} disabled={isFetching}>
				{isFetching ? "Searching..." : "Search"}
			</Button>

			{isLoading && <p className="text-muted-foreground">Loading...</p>}
			{data && (
				<pre className="rounded-md bg-muted p-4 text-sm overflow-auto">
					{JSON.stringify(data, null, 2)}
				</pre>
			)}
		</div>
	);
}
