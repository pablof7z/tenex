import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useMemo } from "react";

export interface AgentLLMInfo {
    model: string;
    provider?: string;
    timestamp: number;
}

/**
 * Hook to track the latest LLM model used by each agent
 * by analyzing messages with LLM metadata
 */
export function useAgentLLMTracking(messages: NDKEvent[]): Map<string, AgentLLMInfo> {
    return useMemo(() => {
        const agentModels = new Map<string, AgentLLMInfo>();

        // Process messages in chronological order to get the latest model used
        const sortedMessages = [...messages].sort(
            (a, b) => (a.created_at || 0) - (b.created_at || 0)
        );

        for (const message of sortedMessages) {
            const model = message.tagValue("llm-model");
            const provider = message.tagValue("llm-provider");

            if (model && message.created_at) {
                agentModels.set(message.pubkey, {
                    model,
                    provider,
                    timestamp: message.created_at,
                });
            }
        }

        return agentModels;
    }, [messages]);
}

/**
 * Get the latest LLM model for a specific agent
 */
export function useAgentLatestModel(
    pubkey: string,
    messages: NDKEvent[]
): AgentLLMInfo | undefined {
    const allModels = useAgentLLMTracking(messages);
    return allModels.get(pubkey);
}
