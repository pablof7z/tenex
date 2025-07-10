import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useCallback, useState } from "react";
import { NDKMCPTool } from "@tenex/cli/events";

export function useMCPToolActions() {
    const { ndk } = useNDK();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToolId = useCallback((tool: NDKMCPTool) => {
        if (tool.id) {
            navigator.clipboard.writeText(tool.id);
            setCopiedId(tool.id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    }, []);

    const deleteTool = useCallback(
        (tool: NDKMCPTool, onSuccess?: () => void) => {
            if (!ndk || !tool.id) return;

            const confirmDelete = window.confirm(
                `Are you sure you want to delete "${tool.name || "this MCP tool"}"?`
            );

            if (confirmDelete) {
                // Create a deletion event
                tool.delete();
                onSuccess?.();
            }
        },
        [ndk]
    );

    return {
        copiedId,
        copyToolId,
        deleteTool,
    };
}