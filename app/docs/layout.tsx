import { DocsLayoutClient } from "./docs-layout-client";

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<DocsLayoutClient smitheryApiKey={process.env.SMITHERY_API_KEY}>
			{children}
		</DocsLayoutClient>
	);
}
