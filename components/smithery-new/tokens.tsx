"use client";

import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { createToken } from "@/lib/actions";
import { useAtom } from "jotai";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { selectedTokenAtom, tokensCreatedAtom } from "@/lib/atoms";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Trash2 } from "lucide-react";

export function Tokens({
	initialTokenResponse,
}: {
	initialTokenResponse: CreateTokenResponse;
}) {
	const [tokensCreated, setTokensCreated] = useAtom(tokensCreatedAtom);
	const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		setTokensCreated((prev) => {
			// Only add if it doesn't already exist
			if (prev.some((token) => token.token === initialTokenResponse.token)) {
				return prev;
			}
			return [...prev, initialTokenResponse];
		});
	}, [initialTokenResponse, setTokensCreated]);

	useEffect(() => {
		if (!selectedToken && tokensCreated.length > 0) {
			setSelectedToken(tokensCreated[0]);
		}
	}, [selectedToken, setSelectedToken, tokensCreated]);

	const handleRemoveToken = () => {
		if (!selectedToken) return;

		setTokensCreated((prev) =>
			prev.filter((token) => token.token !== selectedToken.token),
		);
		setSelectedToken(null);
	};

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
										const token = tokensCreated.find((t) => t.token === tokenValue);
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
											Expires: {new Date(selectedToken.expiresAt).toLocaleString()}
										</div>
									)}
								</div>
								{tokensCreated.length > 1 &&
									selectedToken.expiresAt !== "never" && (
										<Button
											variant="ghost"
											size="icon-sm"
											onClick={handleRemoveToken}
											aria-label="Remove token"
										>
											<Trash2 className="size-4" />
										</Button>
									)}
							</div>
						</div>

						<div className="flex  gap-2">
							<Button
								onClick={() => {
									createToken({ ttlSeconds: 60 * 60 * 24, userId: "123" }).then(
										(tokenResponse) => {
											setTokensCreated([...tokensCreated, tokenResponse]);
											setSelectedToken(tokenResponse);
										},
									);
								}}
								variant="secondary"
								className="flex-1"
							>
								Create New Token
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
