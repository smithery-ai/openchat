"use client";

import { Suspense } from "react";
import { SharedSidebar } from "@/components/shared-sidebar";
import { SmitheryProvider } from "@/registry/new-york/smithery/smithery-provider";

export function DocsLayoutClient({ children }: { children: React.ReactNode }) {
	return (
		<SmitheryProvider>
			<SharedSidebar>
				<Suspense
					fallback={
						<div className="max-w-4xl mx-auto px-6 py-8 text-muted-foreground">
							Loading...
						</div>
					}
				>
					<div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
				</Suspense>
			</SharedSidebar>
		</SmitheryProvider>
	);
}
