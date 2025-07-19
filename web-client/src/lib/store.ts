import type { NDKEvent, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import type { BackendInfo } from "./types.js";
import { atom } from "jotai";

// Re-export BackendInfo from local types
export type { BackendInfo } from "./types.js";

// Map to track online backends: pubkey -> BackendInfo
export const onlineBackendsAtom = atom<Map<string, BackendInfo>>(new Map<string, BackendInfo>());

// Selected task for desktop split-screen view
export const selectedTaskAtom = atom<NDKTask | null>(null);

// Selected thread for desktop split-screen view
export const selectedThreadAtom = atom<NDKEvent | null>(null);

// Theme state with localStorage persistence
const getInitialTheme = () => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const themeAtom = atom<"light" | "dark">(getInitialTheme());

// Derived atom for theme toggle
export const toggleThemeAtom = atom(null, (get, set) => {
    const currentTheme = get(themeAtom);
    const newTheme = currentTheme === "light" ? "dark" : "light";
    set(themeAtom, newTheme);
    localStorage.setItem("theme", newTheme);

    // Update document class
    if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
});

// Thread/conversation drafts - Map<rootEventId, draftText>
// For threads: rootEventId is the thread event ID (or 'new-{threadTitle}' for new threads)
// For tasks: rootEventId is the task ID
export const messageDraftsAtom = atom<Map<string, string>>(new Map());
