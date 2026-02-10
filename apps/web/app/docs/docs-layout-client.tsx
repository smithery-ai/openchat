"use client";

import { SmitheryProvider } from "@openchat/registry/smithery/smithery-provider";
import { Suspense } from "react";
import { createSandboxToken } from "@/app/actions/create-token";
import { SharedSidebar } from "@/components/shared-sidebar";

export function DocsLayoutClient({ children }: { children: React.ReactNode }) {
	return (
		<SmitheryProvider createSandboxToken={createSandboxToken}>
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
