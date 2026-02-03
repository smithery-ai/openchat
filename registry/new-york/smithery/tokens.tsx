"use client";

import { useAtom } from "jotai";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { selectedTokenAtom, tokensCreatedAtom } from "@/hooks/use-smithery";
import { useSmitheryContext } from "@/registry/new-york/smithery/smithery-provider";

export function Tokens() {
	const [tokensCreated, setTokensCreated] = useAtom(tokensCreatedAtom);
	const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
	const [isOpen, setIsOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	const { createToken, loading } = useSmitheryContext();

	const handleRemoveToken = () => {
		if (!selectedToken) return;

		setTokensCreated((prev) =>
			prev.filter((token) => token.token !== selectedToken.token),
		);
		setSelectedToken(null);
	};

	const handleCreateToken = async () => {
		setIsCreating(true);
		try {
			await createToken();
		} finally {
			setIsCreating(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
				<span>Loading token...</span>
			</div>
		);
	}

	if (!selectedToken) return null;

	return (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			<span>
				Using token:{" "}
				{selectedToken.token.startsWith("v4.public")
					? "Service Token"
					: "Root API Key"}{" "}
				*****{selectedToken.token.slice(-4)}
			</span>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" size="sm">
						Modify
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Manage Tokens</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						{tokensCreated.length > 1 && (
							<div className="space-y-2">
								<div className="text-sm font-medium">Select Token</div>
								<Select
									value={selectedToken.token}
									onValueChange={(tokenValue) => {
										const token = tokensCreated.find(
											(t) => t.token === tokenValue,
										);
										if (token) setSelectedToken(token);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{tokensCreated.map((token) => (
											<SelectItem key={token.token} value={token.token}>
												{token.token.startsWith("v4.public")
													? "Service Token"
													: "Root API Key"}
												: *****{token.token.slice(-4)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						<div className="rounded-lg border p-4 space-y-2">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="font-medium">
										{selectedToken.token.startsWith("v4.public")
											? "Service Token"
											: "Root API Key"}
										: *****{selectedToken.token.slice(-4)}
									</div>
									{selectedToken.expiresAt !== "never" && (
										<div className="text-sm text-muted-foreground">
											Expires:{" "}
											{new Date(selectedToken.expiresAt).toLocaleString()}
										</div>
									)}
								</div>
								<Button
									variant="ghost"
									size="icon-sm"
									onClick={handleRemoveToken}
									aria-label="Remove token"
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						</div>

						<div className="flex gap-2">
							<Button
								onClick={handleCreateToken}
								variant="secondary"
								className="flex-1"
								disabled={isCreating}
							>
								{isCreating ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Creating...
									</>
								) : (
									"Create New Token"
								)}
							</Button>
							<Button onClick={() => setIsOpen(false)} className="flex-1">
								Done
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
