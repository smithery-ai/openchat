import { HomePage } from "@/components/home";

export default function Home() {
	const smitheryApiKey = process.env.SMITHERY_API_KEY ?? "";
	return <HomePage smitheryApiKey={smitheryApiKey} />;
}
