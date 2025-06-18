import type { NDKEvent, NDKProject, NDKTask } from "@nostr-dev-kit/ndk-hooks";
import type { LLMConfig } from "@tenex/types/llm";
import { atom } from "jotai";

// Backend info structure
export interface BackendInfo {
    name: string;
    hostname: string;
    lastSeen: number;
    projects: {
        name: string;
        title?: string;
        description?: string;
        naddr?: string;
        agentCount: number;
    }[];
}

// Map to track online backends: pubkey -> BackendInfo
export const onlineBackendsAtom = atom<Map<string, BackendInfo>>(new Map<string, BackendInfo>());

// Map to track online projects from kind 24010 events: projectDir -> timestamp
export const onlineProjectStatusAtom = atom<Map<string, number>>(new Map());

// Map to track project LLM configurations from kind 24010 events: projectDir -> llmConfigs
export const projectLLMConfigsAtom = atom<Map<string, Record<string, LLMConfig | string>>>(
    new Map()
);

// Derived atom to get all online project directories (combines both sources)
export const onlineProjectsAtom = atom((get) => {
    const backends = get(onlineBackendsAtom);
    const projectStatus = get(onlineProjectStatusAtom);
    const projects = new Set<string>();

    // Add projects from backends
    for (const backend of backends.values()) {
        for (const project of backend.projects) {
            projects.add(project.name);
        }
    }

    // Add projects from status events
    const now = Date.now() / 1000;
    for (const [projectDir, timestamp] of projectStatus.entries()) {
        // Only include projects that have pinged in the last 90 seconds
        if (now - timestamp <= 90) {
            projects.add(projectDir);
        }
    }

    return projects;
});

// Selected task for desktop split-screen view
export const selectedTaskAtom = atom<NDKTask | null>(null);

// Selected thread for desktop split-screen view
export const selectedThreadAtom = atom<NDKEvent | null>(null);

// Selected project for desktop drawer view
export const selectedProjectAtom = atom<NDKProject | null>(null);

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

// Thread/conversation drafts - Map<conversationId, draftText>
// For threads: conversationId is the thread event ID (or 'new-{threadTitle}' for new threads)
// For tasks: conversationId is the task ID
export const messageDraftsAtom = atom<Map<string, string>>(new Map());
