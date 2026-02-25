"use client";

import { Suspense } from "react";
import { SmitheryProvider } from "@/registry/new-york/smithery/smithery-provider";
import { RegistryBrowser } from "./registry-browser";

interface HomePageProps {
	smitheryApiKey?: string;
}

export function HomePage({ smitheryApiKey }: HomePageProps) {
	return (
		<Suspense>
			<SmitheryProvider smitheryApiKey={smitheryApiKey}>
				<RegistryBrowser />
			</SmitheryProvider>
		</Suspense>
	);
}
