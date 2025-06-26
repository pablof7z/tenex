import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { EVENT_KINDS } from "../lib/types.js";

/**
 * Get a display name for a pubkey
 */
function getDisplayName(
    pubkey: string,
    profiles: Map<string, any>,
    isAgent = false
): string {
    if (isAgent) {
        const profile = profiles.get(pubkey);
        const agentName = profile?.name || "Agent";
        return agentName;
    }
    return "User";
}

/**
 * Convert thread messages to markdown format
 */
export function threadToMarkdown(
    messages: NDKEvent[],
    profiles: Map<string, any>,
    threadTitle?: string
): string {
    if (!messages || messages.length === 0) {
        return "";
    }

    let markdown = "";

    // Add thread title if provided
    if (threadTitle) {
        markdown += `# ${threadTitle}\n\n`;
    }

    // Add metadata
    markdown += `Thread created: ${messages[0]?.created_at || 0}\n`;
    markdown += `Messages: ${messages.length}\n\n`;

    // Add each message
    for (const message of messages) {
        const isAgent = message.kind === EVENT_KINDS.AGENT_REQUEST;
        const author = getDisplayName(message.pubkey, profiles, isAgent);
        const timestamp = message.created_at || 0; // Use Unix timestamp directly

        // Handle different message types
        if (message.kind === EVENT_KINDS.CHAT || message.kind === EVENT_KINDS.THREAD_REPLY) {
            // Regular chat message
            markdown += `${author} - ${timestamp}:\n${message.content}\n\n`;
        } else if (message.kind === EVENT_KINDS.TASK) {
            // Task creation
            const taskTitle =
                message.tags?.find((tag) => tag[0] === "title")?.[1] || "Untitled Task";
            const complexity = message.tags?.find((tag) => tag[0] === "complexity")?.[1] || "?";
            markdown += `${author} - ${timestamp}:\n`;
            markdown += `[Task: ${taskTitle}] Complexity: ${complexity}/10\n`;
            if (message.content) {
                markdown += `${message.content}\n`;
            }
            markdown += "\n";
        } else if (message.kind === EVENT_KINDS.AGENT_REQUEST) {
            // Agent status update
            const agentName = message.tags?.find((tag) => tag[0] === "agent-name")?.[1] || "Agent";
            const confidence =
                message.tags?.find((tag) => tag[0] === "confidence-level")?.[1] || "?";
            const title = message.tags?.find((tag) => tag[0] === "title")?.[1] || "";

            markdown += `${agentName} - ${timestamp}:\n`;
            if (title) {
                markdown += `[${title}] `;
            }
            markdown += `${message.content} (Confidence: ${confidence}/10)\n\n`;
        } else {
            // Other event types - generic format
            markdown += `${author} - ${timestamp}:\n${message.content || "(No content)"}\n\n`;
        }

        // Remove separator between messages
    }

    return markdown;
}

/**
 * Copy thread messages to clipboard as markdown
 */
export async function copyThreadToClipboard(
    messages: NDKEvent[],
    profiles: Map<string, any>,
    threadTitle?: string
): Promise<boolean> {
    try {
        const markdown = threadToMarkdown(messages, profiles, threadTitle);
        await navigator.clipboard.writeText(markdown);
        return true;
    } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        return false;
    }
}
