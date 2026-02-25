import { HomePage } from "@/components/home";

export default function Home() {
	return <HomePage smitheryApiKey={process.env.SMITHERY_API_KEY} />;
}
