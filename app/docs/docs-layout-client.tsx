"use client";

import { SharedSidebar } from "@/components/shared-sidebar";

export function DocsLayoutClient({ children }: { children: React.ReactNode }) {
	return (
		<SharedSidebar>
			<div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
		</SharedSidebar>
	);
}
