"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"

interface ApiKeyConfigDialogProps {
	error: string | null
	onSubmit: (apiKey: string) => void
	isValidating?: boolean
}

export function ApiKeyConfigDialog({
	error,
	onSubmit,
	isValidating = false,
}: ApiKeyConfigDialogProps) {
	const [apiKey, setApiKey] = useState("")

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (apiKey.trim()) {
			onSubmit(apiKey.trim())
		}
	}

	return (
		<Dialog open={true}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Smithery API Key Required</DialogTitle>
					<DialogDescription>
						Enter your Smithery API key to use this chat application.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="api-key">Smithery API Key</Label>
						<p className="text-xs text-muted-foreground">
							Get one at:{" "}
							<Link
								href="https://smithery.ai/account/api-keys"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-500"
							>
								https://smithery.ai/account/api-keys
							</Link>
						</p>
						<Input
							id="api-key"
							type="password"
							placeholder="Enter your API key"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							disabled={isValidating}
							autoFocus
						/>
						<p className="text-xs text-muted-foreground">
							Your API key will be stored locally in your browser and used for
							all requests.
						</p>
					</div>

					<Button type="submit" className="w-full" disabled={isValidating}>
						{isValidating ? "Validating..." : "Continue"}
					</Button>

					<div className="space-y-2 pt-4 border-t">
						<p className="text-sm font-medium">
							Alternatively, use environment variable:
						</p>
						<p className="text-xs text-muted-foreground">
							Add to your{" "}
							<code className="px-1 py-0.5 bg-muted rounded">.env.local</code>{" "}
							file and restart the server:
						</p>
						<pre className="p-3 bg-muted rounded-md text-xs font-mono">
							SMITHERY_API_KEY=your_api_key_here
						</pre>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	)
}
