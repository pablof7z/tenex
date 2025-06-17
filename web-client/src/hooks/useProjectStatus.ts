import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { EVENT_KINDS } from "@tenex/types/events";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { onlineProjectStatusAtom, projectLLMConfigsAtom } from "../lib/store";

// Custom hook to track online project status from kind 24010 events
export function useProjectStatus() {
    const setOnlineProjectStatus = useSetAtom(onlineProjectStatusAtom);
    const setProjectLLMConfigs = useSetAtom(projectLLMConfigsAtom);

    // Set up periodic cleanup of stale entries
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            setOnlineProjectStatus((prevStatus) => {
                const newStatus = new Map(prevStatus);
                const now = Date.now() / 1000;

                // Remove entries older than 90 seconds
                for (const [projectDir, timestamp] of newStatus.entries()) {
                    if (now - timestamp > 90) {
                        newStatus.delete(projectDir);
                    }
                }

                return newStatus;
            });
        }, 30000); // Run cleanup every 30 seconds

        return () => clearInterval(cleanupInterval);
    }, [setOnlineProjectStatus]);

    // Subscribe to kind 24010 events (project status pings)
    const { events: statusEvents } = useSubscribe(
        [
            {
                kinds: [EVENT_KINDS.PROJECT_STATUS],
                since: Math.floor(Date.now() / 1000) - 300, // Last 5 minutes
            },
        ],
        {},
        []
    );

    // Update the online projects map when new status events come in
    useEffect(() => {
        if (!statusEvents || statusEvents.length === 0) return;

        setOnlineProjectStatus((prevStatus) => {
            const newStatus = new Map(prevStatus);

            // Process status events to determine which projects are online
            for (const event of statusEvents) {
                // Find the "a" tag to get project info
                const aTag = event.tags?.find((tag) => tag[0] === "a");
                if (aTag?.[1]) {
                    // Extract project directory from the tag
                    // Format: 31933:pubkey:directory
                    const parts = aTag[1].split(":");
                    if (parts.length >= 3) {
                        const projectDir = parts[2];
                        if (projectDir) {
                            // Update timestamp for this project
                            newStatus.set(projectDir, event.created_at || Date.now() / 1000);
                        }
                    }
                }
            }

            // Clean up old entries (older than 90 seconds)
            const now = Date.now() / 1000;
            for (const [projectDir, timestamp] of newStatus.entries()) {
                if (now - timestamp > 90) {
                    newStatus.delete(projectDir);
                }
            }

            return newStatus;
        });

        // Also update LLM configurations
        setProjectLLMConfigs((prevConfigs) => {
            const newConfigs = new Map(prevConfigs);

            for (const event of statusEvents) {
                // Find the "a" tag to get project info
                const aTag = event.tags?.find((tag) => tag[0] === "a");
                if (aTag?.[1]) {
                    const parts = aTag[1].split(":");
                    if (parts.length >= 3) {
                        const projectDir = parts[2];

                        // Parse content to get LLM configurations
                        if (projectDir) {
                            try {
                                const content = JSON.parse(event.content);
                                if (content.llmConfigs && typeof content.llmConfigs === "object") {
                                    newConfigs.set(projectDir, content.llmConfigs);
                                }
                            } catch (_e) {}
                        }
                    }
                }
            }

            // Clean up configs for offline projects
            const now = Date.now() / 1000;
            for (const [projectDir] of newConfigs.entries()) {
                const statusEvent = statusEvents.find((e) => {
                    const aTag = e.tags?.find((tag) => tag[0] === "a");
                    if (aTag?.[1]) {
                        const parts = aTag[1].split(":");
                        return parts.length >= 3 && parts[2] === projectDir;
                    }
                    return false;
                });

                if (!statusEvent || (statusEvent.created_at && now - statusEvent.created_at > 90)) {
                    newConfigs.delete(projectDir);
                }
            }

            return newConfigs;
        });
    }, [statusEvents, setOnlineProjectStatus, setProjectLLMConfigs]);
}
