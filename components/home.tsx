"use client";

import { RegistryBrowser } from "./registry-browser";

export function HomePage({ namespace }: { namespace?: string }) {
	return <RegistryBrowser namespace={namespace} />;
}
