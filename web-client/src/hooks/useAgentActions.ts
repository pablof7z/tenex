import { useState } from "react";
import type { NDKAgent } from "../lib/ndk-setup";

export function useAgentActions() {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyAgentId = async (agent: NDKAgent): Promise<void> => {
        if (!agent) return;

        try {
            const encoded = agent.encode();
            await navigator.clipboard.writeText(encoded);
            setCopiedId(agent.id);

            // Reset copied state after 2 seconds
            setTimeout(() => {
                setCopiedId(null);
            }, 2000);
        } catch (error) {
            console.error("Failed to copy agent ID:", error);
        }
    };

    const deleteAgent = async (agent: NDKAgent, onSuccess?: () => void): Promise<void> => {
        if (!agent) return;

        const agentName = agent.title || "this agent";

        if (
            !confirm(`Are you sure you want to delete ${agentName}? This action cannot be undone.`)
        ) {
            return;
        }

        try {
            await agent.delete();
            onSuccess?.();
        } catch (error) {
            console.error("Failed to delete agent:", error);
            alert("Failed to delete agent. Please try again.");
        }
    };

    return {
        copiedId,
        copyAgentId,
        deleteAgent,
    };
}
