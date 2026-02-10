"use client";

import { Suspense } from "react";
import { createSandboxToken } from "@/app/actions/create-token";
import { SmitheryProvider } from "@openchat/registry/smithery/smithery-provider";
import { RegistryBrowser } from "./registry-browser";

export function HomePage() {
	return (
		<Suspense>
			<SmitheryProvider createSandboxToken={createSandboxToken}>
				<RegistryBrowser />
			</SmitheryProvider>
		</Suspense>
	);
}
