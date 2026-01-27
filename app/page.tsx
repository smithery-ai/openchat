import { HomePage } from "@/components/home";
import { getDefaultNamespace } from "@/lib/actions";

export default async function Home() {
	const namespace = await getDefaultNamespace();
	return <HomePage namespace={namespace} />;
}
