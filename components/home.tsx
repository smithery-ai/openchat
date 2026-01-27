"use client";

import { Suspense } from "react";
import { RegistryBrowser } from "./registry-browser";

export function HomePage({ namespace }: { namespace?: string }) {
	return (
		<Suspense>
			<RegistryBrowser namespace={namespace} />
		</Suspense>
	);
}
