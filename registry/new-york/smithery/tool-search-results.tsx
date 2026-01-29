import { MessageCircleWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { ToolSearchResult } from "./types";

export const ToolSearchResults = ({
	results,
}: {
	results: ToolSearchResult;
}) => {
	return (
		<div>
			<h2>Tool Search Results for "{results.action}"</h2>
			<div className="flex overflow-x-auto py-4 gap-4 w-full">
				{results.searchResults.length === 0 && (
					<Alert variant="default" className="max-w-md mx-auto">
						<MessageCircleWarning className="size-4" />
						<AlertTitle>No Results Found</AlertTitle>
						<AlertDescription className="flex flex-wrap items-center gap-1">
							<span>
								Sorry, no tools found for &quot;{results.action.trim()}&quot;.
								Please try different keywords.
							</span>
						</AlertDescription>
					</Alert>
				)}
				{results.searchResults.length > 0 &&
					results.searchResults.map((result) => (
						<Card
							key={`${result.connectionId}-${result.tool.name}`}
							className="min-w-xs max-w-xs flex flex-col"
						>
							<CardHeader>
								<CardTitle>{result.tool.name}</CardTitle>
								<CardDescription>
									<p className="line-clamp-2">{result.tool.description}</p>
								</CardDescription>
							</CardHeader>
							<CardContent className="mt-auto">
								<Dialog>
									<DialogTrigger asChild>
										<Button variant="outline">View Tool Details</Button>
									</DialogTrigger>
									<DialogContent>
										<DialogTitle>{result.tool.name}</DialogTitle>
										<DialogDescription>
											{result.tool.description}
										</DialogDescription>
									</DialogContent>
								</Dialog>
							</CardContent>
						</Card>
					))}
			</div>
			<pre>{JSON.stringify(results, null, 2)}</pre>
		</div>
	);
};
