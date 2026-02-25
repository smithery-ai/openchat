import { DocsLayoutClient } from "./docs-layout-client";

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const smitheryApiKey = process.env.SMITHERY_API_KEY ?? "";
	return (
		<DocsLayoutClient smitheryApiKey={smitheryApiKey}>
			{children}
		</DocsLayoutClient>
	);
}
