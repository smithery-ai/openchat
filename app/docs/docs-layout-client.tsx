"use client";

import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { SharedSidebar } from "@/components/shared-sidebar";

export function DocsLayoutClient({
	initialTokenResponse,
	children,
}: {
	initialTokenResponse: CreateTokenResponse;
	children: React.ReactNode;
}) {
	return (
		<SharedSidebar initialTokenResponse={initialTokenResponse}>
			<div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
		</SharedSidebar>
	);
}
