import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";

export function isTokenExpired(token: CreateTokenResponse): boolean {
	if (token.expiresAt === "never") return false;
	return new Date(token.expiresAt).getTime() <= Date.now();
}

export function filterExpiredTokens(
	tokens: CreateTokenResponse[],
): CreateTokenResponse[] {
	return tokens.filter((token) => !isTokenExpired(token));
}
