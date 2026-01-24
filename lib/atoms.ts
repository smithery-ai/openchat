import { atomWithStorage } from "jotai/utils";
import type { CreateTokenResponse } from "@smithery/api/resources/tokens.mjs";
import { atom } from "jotai";

export const tokensCreatedAtom = atomWithStorage<CreateTokenResponse[]>("tokensCreated", []);
export const selectedTokenAtom = atom<CreateTokenResponse | null>(null);