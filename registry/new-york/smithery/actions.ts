import type { NamespaceListResponse } from "@smithery/api/resources/index.mjs";

export async function listNamespaces(): Promise<
	NamespaceListResponse["namespaces"]
> {
	return [];
}
