"use client";

import { Suspense } from "react";
import { SmitheryProvider } from "@/registry/new-york/smithery/smithery-provider";
import { RegistryBrowser } from "./registry-browser";

export function HomePage() {
	return (
		<Suspense>
			<SmitheryProvider>
				<RegistryBrowser />
			</SmitheryProvider>
		</Suspense>
	);
}
