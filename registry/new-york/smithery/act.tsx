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
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "@/components/ui/combobox";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { Input } from "@/components/ui/input";

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
		[],
	);
	const [inputValue, setInputValue] = useState("");
	const [action, setAction] = useState(defaultAction);
	const anchorRef = useComboboxAnchor();

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
		<div>
			<div className="w-full max-w-md">
				<Combobox
					multiple
					autoHighlight
					items={connectionIds}
					value={selectedConnectionIds}
					onValueChange={handleSelectionChange}
				>
					<ComboboxChips ref={anchorRef}>
						<ComboboxValue>
							{(values) => (
								<Fragment>
									{values.map((id: string) => {
										const connection = getConnectionById(id);
										return (
											<ComboboxChip key={id}>
												<Avatar className="size-3 rounded-md">
													<AvatarImage
														src={connection?.iconUrl ?? ""}
														alt={connection?.name ?? ""}
													/>
													<AvatarFallback className="rounded-md bg-muted">
														{connection?.name?.charAt(0) ?? ""}
													</AvatarFallback>
												</Avatar>
												{connection?.name ?? id}
											</ComboboxChip>
										);
									})}
									<ComboboxChipsInput
										placeholder="Select connections..."
										value={inputValue}
										onChange={(e) => setInputValue(e.target.value)}
									/>
								</Fragment>
							)}
						</ComboboxValue>
					</ComboboxChips>
					<ComboboxContent anchor={anchorRef} side="bottom" align="start">
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
				<Input
					defaultValue={defaultAction}
					onChange={(e) => setAction(e.target.value)}
					className="w-full"
					placeholder="Enter action text"
				/>
			</div>

			<p>{action}</p>
			<Button type="button" onClick={() => refetch()} disabled={isFetching}>
				Refresh
			</Button>
			{isLoading && <p>Loading...</p>}
			{data && <pre>{JSON.stringify(data, null, 2)}</pre>}
		</div>
	);
}
