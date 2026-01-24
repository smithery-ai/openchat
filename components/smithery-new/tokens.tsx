"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { createToken } from "@/lib/actions";
import { useAtom } from "jotai";
import { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { selectedTokenAtom, tokensCreatedAtom } from "@/lib/atoms";

export function Tokens({
	initialTokenResponse,
}: {
	initialTokenResponse: CreateTokenResponse;
}) {
	const [tokensCreated, setTokensCreated] = useAtom(tokensCreatedAtom);
	const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
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

	return (
		<div>
			<div className="flex flex-col gap-2 mb-8">
				{tokensCreated.map((token) =>
					<div key={token.token}>
						<h1>Token: {token.token.slice(0, 10)}...</h1>
						<p>Expires at: {token.expiresAt}</p>
						{selectedToken?.token === token.token ? <p>Selected</p> : <Button
							onClick={() => {
								setSelectedToken(token);
							}}
						>
							Select Token
						</Button>}
					</div>
				)}
			</div>
			<Button
				onClick={() => {
					createToken({ ttlSeconds: 60 * 60 * 24, userId: "123" }).then(
						(tokenResponse) => {
							setTokensCreated([...tokensCreated, tokenResponse]);
						},
					);
				}}
			>
				Create Token
			</Button>
		</div>
	);
}
