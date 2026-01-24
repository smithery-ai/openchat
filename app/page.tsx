"use server";
import { Suspense } from "react";
import { HomePage } from "@/components/home";
import { Spinner } from "@/components/ui/spinner";
import { getApiKey, getDefaultNamespace } from "@/lib/actions";

async function HomePageWrapper() {
	await new Promise((resolve) => setTimeout(resolve, 5_000));
	const initialTokenResponse = await getApiKey();
	const namespace = await getDefaultNamespace();
	return (
		<HomePage
			initialTokenResponse={initialTokenResponse}
			namespace={namespace}
		/>
	);
}

export default async function Home() {
	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-screen gap-2">
					<Spinner className="size-8" /> Fetching API Keys...
				</div>
			}
		>
			<HomePageWrapper />
		</Suspense>
	);
}
