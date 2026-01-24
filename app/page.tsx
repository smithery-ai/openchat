"use server";
import { Suspense } from "react";
import { HomePage } from "@/components/home";
import { getApiKey, getDefaultNamespace } from "@/lib/actions";

export default async function Home() {
	const initialTokenResponse = await getApiKey();
	const namespace = await getDefaultNamespace();
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<HomePage
				initialTokenResponse={initialTokenResponse}
				namespace={namespace}
			/>
		</Suspense>
	);
}
