import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getApiKey } from "@/lib/actions";
import { DocsLayoutClient } from "./docs-layout-client";

async function DocsLayoutWrapper({ children }: { children: React.ReactNode }) {
	const initialTokenResponse = await getApiKey();
	return (
		<DocsLayoutClient initialTokenResponse={initialTokenResponse}>
			{children}
		</DocsLayoutClient>
	);
}

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen">
					<Spinner className="h-8 w-8" />
				</div>
			}
		>
			<DocsLayoutWrapper>{children}</DocsLayoutWrapper>
		</Suspense>
	);
}
