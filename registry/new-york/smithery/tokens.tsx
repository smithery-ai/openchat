"use client";

import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { filterExpiredTokens, isTokenExpired } from "@/lib/utils";
// Jotai atoms for token state management
export const tokensCreatedAtom = atomWithStorage<CreateTokenResponse[]>(
	"tokensCreated",
	[],
);
export const selectedTokenAtom = atom<CreateTokenResponse | null>(null);

export function Tokens({
	getOrCreateToken,
}: {
	getOrCreateToken: (options: {
		hasExistingTokens: boolean;
		forceCreate?: boolean;
	}) => Promise<CreateTokenResponse | null>;
}) {
	const [tokensCreated, setTokensCreated] = useAtom(tokensCreatedAtom);
	const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
	const [isOpen, setIsOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [hydrated, setHydrated] = useState(false);
	const fetchStarted = useRef(false);

	// Wait for atom to hydrate
	useEffect(() => {
		setHydrated(true);
	}, []);

	// Filter expired tokens after hydration
	useEffect(() => {
		if (!hydrated) return;
		setTokensCreated((current) => {
			const validTokens = filterExpiredTokens(current);
			if (validTokens.length !== current.length) {
				return validTokens;
			}
			return current;
		});
	}, [hydrated, setTokensCreated]);

	// Fetch token after hydration
	useEffect(() => {
		if (!hydrated) return;
		if (fetchStarted.current) return;
		fetchStarted.current = true;

		async function fetchToken() {
			const hasExistingTokens = tokensCreated.length > 0;
			const tokenResponse = await getOrCreateToken({ hasExistingTokens });

			if (tokenResponse) {
				// Merge with current tokens using callback to get fresh state
				setTokensCreated((current) => {
					const alreadyExists = current.some(
						(t) => t.token === tokenResponse.token,
					);
					if (alreadyExists) return current;
					return [tokenResponse, ...current];
				});
				setSelectedToken(tokenResponse);
			}

			setIsLoading(false);
		}

		fetchToken();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		hydrated,
		getOrCreateToken,
		setSelectedToken, // Merge with current tokens using callback to get fresh state
		setTokensCreated,
		tokensCreated.length,
	]);

	// Select first valid token if none selected or current selection is expired
	useEffect(() => {
		const needsNewSelection = !selectedToken || isTokenExpired(selectedToken);
		if (needsNewSelection && tokensCreated.length > 0) {
			const validToken = tokensCreated.find((t) => !isTokenExpired(t));
			if (validToken) setSelectedToken(validToken);
		}
	}, [selectedToken, setSelectedToken, tokensCreated]);

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
			const tokenResponse = await getOrCreateToken({
				hasExistingTokens: true,
				forceCreate: true,
			});
			if (tokenResponse) {
				setTokensCreated([...tokensCreated, tokenResponse]);
				setSelectedToken(tokenResponse);
			}
		} finally {
			setIsCreating(false);
		}
	};

	if (isLoading) {
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
