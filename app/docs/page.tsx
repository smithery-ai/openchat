import {
	Activity,
	CreditCard,
	FileJson,
	Key,
	LayoutGrid,
	Link2,
	List,
	Search,
	Settings2,
	Square,
	SquareArrowOutUpRight,
} from "lucide-react";
import Link from "next/link";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const components = [
	{
		title: "Tokens",
		slug: "tokens",
		description: "Token selector and manager for Smithery API authentication.",
		icon: Key,
	},
	{
		title: "Server Search",
		slug: "server-search",
		description: "Search and connect to MCP servers by URL.",
		icon: Search,
	},
	{
		title: "Connections",
		slug: "connections",
		description: "Manage MCP server connections with tool browsing.",
		icon: Link2,
	},
	{
		title: "Connection Card",
		slug: "connection-card",
		description: "Display individual connection details with delete functionality.",
		icon: CreditCard,
	},
	{
		title: "Connections List",
		slug: "connections-list",
		description: "Browse and manage connections with search integration.",
		icon: List,
	},
	{
		title: "Active Connection",
		slug: "active-connection",
		description: "View connection details with auth flow and tools panel.",
		icon: Activity,
	},
	{
		title: "Tools Panel",
		slug: "tools-panel",
		description: "Display and interact with a collection of tools.",
		icon: LayoutGrid,
	},
	{
		title: "Tool Card",
		slug: "tool-card",
		description: "Individual tool card with click-to-open detail dialog.",
		icon: Square,
	},
	{
		title: "Tool Detail Dialog",
		slug: "tool-detail-dialog",
		description: "Detailed tool view with parameter form and execution.",
		icon: SquareArrowOutUpRight,
	},
	{
		title: "Schema Form",
		slug: "schema-form",
		description: "Dynamic form generated from JSON Schema definitions.",
		icon: FileJson,
	},
	{
		title: "Connection Context",
		slug: "connection-context",
		description: "Context provider for sharing connection configuration.",
		icon: Settings2,
	},
];

export default function DocsPage() {
	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Smithery Components
				</h1>
				<p className="text-muted-foreground mt-2">
					A collection of React components for building MCP-powered
					applications. Install any component using the shadcn CLI.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{components.map((component) => (
					<Link key={component.slug} href={`/docs/${component.slug}`}>
						<Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
							<CardHeader>
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-md bg-primary/10">
										<component.icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<CardTitle className="text-base">
											{component.title}
										</CardTitle>
										<CardDescription className="text-sm mt-1">
											{component.description}
										</CardDescription>
									</div>
								</div>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
