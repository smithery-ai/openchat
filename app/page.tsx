"use server"
import { ToolSearch } from "@/components/smithery-new/tool-search"
import Image from "next/image"

export default async function Home() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<ToolSearch token={process.env.SMITHERY_API_KEY} />
		</div>
	)
}
