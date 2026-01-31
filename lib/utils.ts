import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function isTokenExpired(token: CreateTokenResponse): boolean {
	if (token.expiresAt === "never") return false;
	return new Date(token.expiresAt).getTime() <= Date.now();
}

export function filterExpiredTokens(
	tokens: CreateTokenResponse[],
): CreateTokenResponse[] {
	return tokens.filter((token) => !isTokenExpired(token));
}
