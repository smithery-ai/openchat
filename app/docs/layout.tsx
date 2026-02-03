import { getDefaultNamespace } from "@/lib/actions";
import { DocsLayoutClient } from "./docs-layout-client";

export default async function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const namespace = await getDefaultNamespace();
	return <DocsLayoutClient namespace={namespace}>{children}</DocsLayoutClient>;
}
