"use client";

import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { RegistryBrowser } from "./registry-browser";

export function HomePage({
	initialTokenResponse,
	namespace,
}: {
	initialTokenResponse: CreateTokenResponse;
	namespace?: string;
}) {
	return (
		<RegistryBrowser
			initialTokenResponse={initialTokenResponse}
			namespace={namespace}
		/>
	);
}
