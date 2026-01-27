import type { MDXComponents } from "mdx/types";
import { ComponentPreview } from "@/components/docs/component-preview";
import { InstallCommand } from "@/components/docs/install-command";
import { PreviewFrame } from "@/components/docs/preview-frame";
import {
	ConnectionsPreview,
	SchemaFormPreview,
	ServerSearchPreview,
	ToolCardPreview,
	ToolDetailDialogPreview,
	ToolsPanelPreview,
} from "@/components/docs/previews";

export function useMDXComponents(components: MDXComponents): MDXComponents {
	return {
		...components,
		InstallCommand,
		ComponentPreview,
		PreviewFrame,
		ServerSearchPreview,
		ConnectionsPreview,
		ToolsPanelPreview,
		ToolCardPreview,
		ToolDetailDialogPreview,
		SchemaFormPreview,
		// Style headings
		h1: ({ children }) => (
			<h1 className="text-3xl font-bold tracking-tight mb-4">{children}</h1>
		),
		h2: ({ children }) => (
			<h2 className="text-2xl font-semibold tracking-tight mt-8 mb-4 border-b pb-2">
				{children}
			</h2>
		),
		h3: ({ children }) => (
			<h3 className="text-xl font-semibold tracking-tight mt-6 mb-3">
				{children}
			</h3>
		),
		p: ({ children }) => (
			<p className="text-muted-foreground mb-4 leading-7">{children}</p>
		),
		code: ({ children }) => (
			<code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
				{children}
			</code>
		),
		pre: ({ children }) => (
			<pre className="bg-muted rounded-lg p-4 overflow-auto mb-4 text-sm">
				{children}
			</pre>
		),
		ul: ({ children }) => (
			<ul className="list-disc list-inside space-y-2 mb-4 text-muted-foreground">
				{children}
			</ul>
		),
		li: ({ children }) => <li className="leading-7">{children}</li>,
	};
}
