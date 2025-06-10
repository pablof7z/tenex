import type { NDKTask } from "@nostr-dev-kit/ndk-hooks";
import { atom } from "jotai";

// Map to track online backends: pubkey -> backend name
export const onlineBackendsAtom = atom<Map<string, string>>(
	new Map<string, string>(),
);

// Selected task for desktop split-screen view
export const selectedTaskAtom = atom<NDKTask | null>(null);
