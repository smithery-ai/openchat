"use client";

import { SmitheryProvider } from "@openchat/registry/smithery/smithery-provider";
import { Suspense } from "react";
import { SharedSidebar } from "@/components/shared-sidebar";
import { BACKEND_URL, SMITHERY_API_URL } from "@/lib/consts";

const createSandboxToken = async ({ userId }: { userId: string }) => {
	const res = await fetch(`${BACKEND_URL}/api/create-token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId }),
	});
	return res.json();
};

export function DocsLayoutClient({ children }: { children: React.ReactNode }) {
	return (
		<SmitheryProvider
			baseURL={SMITHERY_API_URL}
			backendUrl={BACKEND_URL}
			createSandboxToken={createSandboxToken}
		>
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
