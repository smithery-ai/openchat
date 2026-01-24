import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const tokensCreatedAtom = atomWithStorage<CreateTokenResponse[]>(
	"tokensCreated",
	[],
);
export const selectedTokenAtom = atom<CreateTokenResponse | null>(null);
