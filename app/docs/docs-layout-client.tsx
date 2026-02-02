"use client";

import { Suspense } from "react";
import { SharedSidebar } from "@/components/shared-sidebar";
import { SmitheryProvider } from "@/registry/new-york/smithery/smithery-provider";

export function DocsLayoutClient({
	children,
	namespace,
}: {
	children: React.ReactNode;
	namespace: string;
}) {
	return (
		<SharedSidebar>
			<Suspense
				fallback={
					<div className="max-w-4xl mx-auto px-6 py-8 text-muted-foreground">
						Loading...
					</div>
				}
			>
				<SmitheryProvider defaultNamespace={namespace}>
					<div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
				</SmitheryProvider>
			</Suspense>
		</SharedSidebar>
	);
}
