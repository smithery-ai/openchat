"use client";

import type { Tool } from "ai";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@openchat/ui/components/badge";
import { Card, CardHeader } from "@openchat/ui/components/card";
import { cn } from "@openchat/ui/lib/utils";
import { ToolDetailDialog } from "./tool-detail-dialog";

interface ToolCardProps {
	name: string;
	tool: Tool;
	onExecute?: (params: Record<string, unknown>) => Promise<unknown>;
}

export function ToolCard({ name, tool, onExecute }: ToolCardProps) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<>
			<Card
				className={cn(
					"w-full cursor-pointer transition-colors hover:bg-accent/50",
					"group",
				)}
				onClick={() => setDialogOpen(true)}
			>
				<CardHeader>
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<h3 className="font-semibold text-base break-all">{name}</h3>
								<ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
							</div>
							{tool.description && (
								<p className="text-sm text-muted-foreground mt-1 break-words line-clamp-2">
									{tool.description}
								</p>
							)}
						</div>
						{tool.type && tool.type !== "dynamic" && (
							<Badge variant="outline" className="shrink-0">
								{tool.type}
							</Badge>
						)}
					</div>
				</CardHeader>
			</Card>

			<ToolDetailDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				name={name}
				tool={tool}
				onExecute={onExecute}
			/>
		</>
	);
}
