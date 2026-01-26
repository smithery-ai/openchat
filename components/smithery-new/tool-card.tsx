"use client";

import type { Tool } from "ai";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SchemaForm } from "./schema-form";

interface ToolCardProps {
	name: string;
	tool: Tool;
	onExecute?: (params: Record<string, unknown>) => Promise<unknown>;
}

export function ToolCard({ name, tool, onExecute }: ToolCardProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);
	const [result, setResult] = useState<unknown>(null);
	const [error, setError] = useState<string | null>(null);
	const [showResult, setShowResult] = useState(false);
	const [copied, setCopied] = useState(false);
	const [executedAt, setExecutedAt] = useState<Date | null>(null);

	const handleExecute = async (params: Record<string, unknown>) => {
		if (!onExecute) return;

		setIsExecuting(true);
		setError(null);
		setResult(null);

		try {
			// Parse JSON strings for arrays and objects
			const processedParams: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(params)) {
				if (
					typeof value === "string" &&
					(value.startsWith("[") || value.startsWith("{"))
				) {
					try {
						processedParams[key] = JSON.parse(value);
					} catch {
						processedParams[key] = value;
					}
				} else {
					processedParams[key] = value;
				}
			}

			const res = await onExecute(processedParams);
			setResult(res);
			setShowResult(true);
			setExecutedAt(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsExecuting(false);
		}
	};

	const handleCopyResult = async () => {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	// Extract schema from the Tool's inputSchema
	const inputSchema = tool.inputSchema;
	const schema =
		typeof inputSchema === "object" &&
		inputSchema &&
		"jsonSchema" in inputSchema
			? inputSchema.jsonSchema
			: inputSchema;

	const hasParameters =
		schema &&
		typeof schema === "object" &&
		"properties" in schema &&
		schema.properties &&
		Object.keys(schema.properties).length > 0;

	return (
		<Card className="w-full">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-base break-all">{name}</h3>
						{tool.description && (
							<p className="text-sm text-muted-foreground mt-1 break-words">
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

			{hasParameters && (
				<CardContent className="pb-3">
					<Collapsible open={isOpen} onOpenChange={setIsOpen}>
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								className="w-full justify-between"
								size="sm"
							>
								<span className="text-sm font-medium">
									{isOpen ? "Hide" : "Show"} Parameters
								</span>
								{isOpen ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-4">
							<SchemaForm
								schema={schema}
								onSubmit={handleExecute}
								isLoading={isExecuting}
							/>
						</CollapsibleContent>
					</Collapsible>
				</CardContent>
			)}

			{!hasParameters && (
				<CardFooter>
					<Button
						onClick={() => handleExecute({})}
						disabled={isExecuting}
						className="w-full"
					>
						{isExecuting ? "Executing..." : "Execute"}
					</Button>
				</CardFooter>
			)}

			{(result || error) && (
				<CardContent className="pt-0">
					<Collapsible open={showResult} onOpenChange={setShowResult}>
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								className={cn(
									"w-full justify-between",
									error && "text-destructive hover:text-destructive",
								)}
								size="sm"
							>
								<span className="text-sm font-medium">
									{error ? "Error" : "Result"}
									{executedAt && (
										<span className="text-xs text-muted-foreground ml-2">
											{executedAt.toLocaleTimeString()}
										</span>
									)}
								</span>
								{showResult ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2">
							{error ? (
								<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
									{error}
								</div>
							) : (
								<div className="relative">
									<pre className="rounded-md bg-muted p-3 text-sm overflow-auto max-h-96">
										<code>{JSON.stringify(result, null, 2)}</code>
									</pre>
									<Button
										variant="ghost"
										size="icon"
										className="absolute top-2 right-2 h-6 w-6"
										onClick={handleCopyResult}
									>
										{copied ? (
											<Check className="h-3 w-3" />
										) : (
											<Copy className="h-3 w-3" />
										)}
									</Button>
								</div>
							)}
						</CollapsibleContent>
					</Collapsible>
				</CardContent>
			)}
		</Card>
	);
}
