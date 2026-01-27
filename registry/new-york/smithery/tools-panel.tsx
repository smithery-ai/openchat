"use client";

import type { Tool } from "ai";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { estimateTokenCount } from "tokenx";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToolCard } from "@/registry/new-york/smithery/tool-card";

interface ToolsPanelProps {
	tools: Record<string, Tool>;
	onExecute?: (
		toolName: string,
		params: Record<string, unknown>,
	) => Promise<unknown>;
}

export function ToolsPanel({ tools, onExecute }: ToolsPanelProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredTools = useMemo(() => {
		if (!searchQuery.trim()) {
			return Object.entries(tools);
		}

		const query = searchQuery.toLowerCase();
		return Object.entries(tools).filter(([name, tool]) => {
			return (
				name.toLowerCase().includes(query) ||
				tool.description?.toLowerCase().includes(query) ||
				tool.type?.toLowerCase().includes(query)
			);
		});
	}, [tools, searchQuery]);

	const totalToolTokenCount = useMemo(() => {
		return Object.values(tools)
			.reduce((total, tool) => {
				return total + (estimateTokenCount(JSON.stringify(tool)) || 0);
			}, 0)
			.toLocaleString();
	}, [tools]);

	const filteredToolTokenCount = useMemo(() => {
		return Object.values(filteredTools)
			.reduce((total, tool) => {
				return total + (estimateTokenCount(JSON.stringify(tool)) || 0);
			}, 0)
			.toLocaleString();
	}, [filteredTools]);

	const handleExecute = async (
		toolName: string,
		params: Record<string, unknown>,
	) => {
		if (!onExecute) {
			throw new Error("No execute handler provided");
		}
		return await onExecute(toolName, params);
	};

	const toolCount = Object.keys(tools).length;
	const filteredCount = filteredTools.length;

	if (toolCount === 0) {
		return (
			<div className="flex flex-col items-center justify-center p-8 text-center">
				<p className="text-muted-foreground">No tools available</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			<div className="p-6 border-b">
				<div className="flex items-center justify-between gap-2 mb-4">
					<h2 className="text-lg font-semibold">Tools</h2>
					<p className="text-sm text-muted-foreground">
						{filteredCount === toolCount
							? `${toolCount} tool${toolCount === 1 ? "" : "s"}`
							: `${filteredCount} of ${toolCount} tools`}
						{" · "}
						{filteredCount === toolCount
							? `${totalToolTokenCount} input tokens`
							: `${filteredToolTokenCount} of ${totalToolTokenCount} input tokens`}
					</p>
				</div>
				<Field>
					<FieldLabel htmlFor="tool-search" className="sr-only">
						Search tools
					</FieldLabel>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="tool-search"
							type="text"
							placeholder="Search tools by name, description, or type..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
				</Field>
			</div>

			<div className="flex-1 overflow-auto p-6">
				{filteredCount === 0 ? (
					<div className="flex flex-col items-center justify-center p-8 text-center">
						<p className="text-muted-foreground">No tools match your search</p>
						<p className="text-sm text-muted-foreground mt-1">
							Try a different search term
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
						{filteredTools.map(([name, tool]) => (
							<ToolCard
								key={name}
								name={name}
								tool={tool}
								onExecute={(params) => handleExecute(name, params)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
