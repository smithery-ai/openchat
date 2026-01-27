"use client";

import { Download, FileText } from "lucide-react";
import { CodeBlock, CodeBlockCopyButton } from "@/components/smithery/code-block";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// MCP Content Types
interface TextContent {
	type: "text";
	text: string;
}

interface ImageContent {
	type: "image";
	data: string;
	mimeType: string;
}

interface ResourceContent {
	type: "resource";
	resource: {
		uri: string;
		mimeType?: string;
		text?: string;
		blob?: string;
		name?: string;
		title?: string;
	};
}

type ContentItem = TextContent | ImageContent | ResourceContent | { type: string; [key: string]: unknown };

interface ToolResult {
	content?: ContentItem[];
	structuredContent?: unknown;
	isError?: boolean;
	_meta?: Record<string, unknown>;
	toolResult?: unknown;
}

interface ToolOutputViewerProps {
	result: unknown;
	className?: string;
}

function isValidJson(str: string): boolean {
	try {
		JSON.parse(str);
		return true;
	} catch {
		return false;
	}
}

function formatJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

// JSON viewer - always shows full content
function JsonViewer({ json }: { json: string }) {
	return (
		<CodeBlock code={json} language="json">
			<CodeBlockCopyButton />
		</CodeBlock>
	);
}

// Text content viewer with JSON detection
function TextContentViewer({ content }: { content: TextContent }) {
	const { text } = content;
	const trimmed = text.trim();

	// Check if text is JSON
	if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isValidJson(trimmed)) {
		const formatted = formatJson(JSON.parse(trimmed));
		return <JsonViewer json={formatted} />;
	}

	// Plain text - render in a styled container
	return (
		<div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap font-mono">
			{text}
		</div>
	);
}

// Image content viewer
function ImageContentViewer({ content }: { content: ImageContent }) {
	const { data, mimeType } = content;

	return (
		<div className="rounded-md overflow-hidden border bg-muted/50 p-2">
			<img
				src={`data:${mimeType};base64,${data}`}
				alt="Tool output"
				className="max-w-full max-h-96 rounded object-contain"
			/>
		</div>
	);
}

// Resource content viewer
function ResourceContentViewer({ content }: { content: ResourceContent }) {
	const { resource } = content;
	const { uri, mimeType, text, blob, name, title } = resource;

	const displayName = title || name || uri;

	// If it's a text resource
	if (text) {
		const trimmed = text.trim();
		// Check if it's JSON
		if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isValidJson(trimmed)) {
			const formatted = formatJson(JSON.parse(trimmed));
			return (
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<FileText className="h-3 w-3" />
						<span className="truncate">{displayName}</span>
						{mimeType && <span className="text-muted-foreground/70">({mimeType})</span>}
					</div>
					<JsonViewer json={formatted} />
				</div>
			);
		}

		// Plain text resource
		return (
			<div className="space-y-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<FileText className="h-3 w-3" />
					<span className="truncate">{displayName}</span>
					{mimeType && <span className="text-muted-foreground/70">({mimeType})</span>}
				</div>
				<div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap font-mono">
					{text}
				</div>
			</div>
		);
	}

	// If it's a blob resource
	if (blob) {
		// Check if it's an image
		if (mimeType?.startsWith("image/")) {
			return (
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<FileText className="h-3 w-3" />
						<span className="truncate">{displayName}</span>
					</div>
					<div className="rounded-md overflow-hidden border bg-muted/50 p-2">
						<img
							src={`data:${mimeType};base64,${blob}`}
							alt={displayName}
							className="max-w-full max-h-96 rounded object-contain"
						/>
					</div>
				</div>
			);
		}

		// Other blob - show as downloadable
		return (
			<div className="flex items-center gap-3 rounded-md border p-3 bg-muted/50">
				<FileText className="h-5 w-5 text-muted-foreground" />
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium truncate">{displayName}</p>
					{mimeType && <p className="text-xs text-muted-foreground">{mimeType}</p>}
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="shrink-0"
					onClick={() => {
						const link = document.createElement("a");
						link.href = `data:${mimeType || "application/octet-stream"};base64,${blob}`;
						link.download = name || "download";
						link.click();
					}}
				>
					<Download className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	// Fallback - just show URI info
	return (
		<div className="flex items-center gap-2 rounded-md border p-3 bg-muted/50 text-sm">
			<FileText className="h-4 w-4 text-muted-foreground" />
			<span className="truncate">{uri}</span>
		</div>
	);
}

// Generic content item renderer
function ContentItemViewer({ item }: { item: ContentItem }) {
	switch (item.type) {
		case "text":
			return <TextContentViewer content={item as TextContent} />;
		case "image":
			return <ImageContentViewer content={item as ImageContent} />;
		case "resource":
			return <ResourceContentViewer content={item as ResourceContent} />;
		default:
			// Unknown type - render as JSON
			return <JsonViewer json={formatJson(item)} />;
	}
}

export function ToolOutputViewer({ result, className }: ToolOutputViewerProps) {
	// Handle null/undefined
	if (result === null || result === undefined) {
		return (
			<div className={cn("text-sm text-muted-foreground", className)}>
				No output
			</div>
		);
	}

	// Try to parse as ToolResult
	const toolResult = result as ToolResult;

	// Check if it has the toolResult property (alternative format)
	if ("toolResult" in toolResult && toolResult.toolResult !== undefined) {
		return (
			<div className={className}>
				<JsonViewer json={formatJson(toolResult.toolResult)} />
			</div>
		);
	}

	// Check for content array
	const content = toolResult.content;
	const structuredContent = toolResult.structuredContent;
	const isError = toolResult.isError;

	// If we have structured content, render it prominently
	if (structuredContent !== undefined) {
		return (
			<div className={cn("space-y-3", className)}>
				<div className="text-xs font-medium text-muted-foreground">Structured Content</div>
				<JsonViewer json={formatJson(structuredContent)} />
			</div>
		);
	}

	// If we have content array, render each item
	if (Array.isArray(content) && content.length > 0) {
		return (
			<div className={cn("space-y-3", isError && "rounded-md border-destructive/50 bg-destructive/5 p-3", className)}>
				{content.map((item, index) => (
					<ContentItemViewer key={index} item={item} />
				))}
			</div>
		);
	}

	// Fallback: render the entire result as JSON
	return (
		<div className={className}>
			<JsonViewer json={formatJson(result)} />
		</div>
	);
}
