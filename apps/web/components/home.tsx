"use client";

import { SmitheryProvider } from "@openchat/registry/smithery/smithery-provider";
import { Suspense } from "react";
import { BACKEND_URL, SMITHERY_API_URL } from "@/lib/consts";
import { RegistryBrowser } from "./registry-browser";

const createSandboxToken = async ({ userId }: { userId: string }) => {
	const res = await fetch(`${BACKEND_URL}/api/create-token`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId }),
	});
	return res.json();
};

export function HomePage() {
	return (
		<Suspense>
			<SmitheryProvider
				baseURL={SMITHERY_API_URL}
				backendUrl={BACKEND_URL}
				createSandboxToken={createSandboxToken}
			>
				<RegistryBrowser />
			</SmitheryProvider>
		</Suspense>
	);
}
