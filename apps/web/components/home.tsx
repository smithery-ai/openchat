"use client";

import { SmitheryProvider } from "@openchat/registry/smithery/smithery-provider";
import { Suspense } from "react";
import { createSandboxToken } from "@/app/actions/create-token";
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
