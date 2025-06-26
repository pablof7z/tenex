import { NDKEvent, type NDKSigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import type { NDKTag } from "@nostr-dev-kit/ndk";

export interface ToolExecutionStatus {
    tool: string;
    status: 'starting' | 'running' | 'completed' | 'failed';
    args?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    duration?: number;
}

/**
 * Publishes real-time tool execution status updates to Nostr
 */
export async function publishToolExecutionStatus(
    ndk: NDK,
    eventToReply: NDKEvent,
    status: ToolExecutionStatus,
    signer: NDKSigner
): Promise<NDKEvent> {
    try {
        const toolEvent = new NDKEvent(ndk);
        toolEvent.kind = 7777; // Custom kind for tool execution status
        // Build reply tags
        toolEvent.tags = [
            ["e", eventToReply.id || "", ""],
            ["p", eventToReply.pubkey || "", ""]
        ];
        
        // Add tool-specific tags
        toolEvent.tags.push(["tool", status.tool]);
        toolEvent.tags.push(["status", status.status]);
        
        // Build content with status details
        const contentParts: string[] = [];
        
        switch (status.status) {
            case 'starting':
                contentParts.push(`🔧 Preparing to run ${status.tool}...`);
                if (status.args) {
                    contentParts.push(`Parameters: ${JSON.stringify(status.args, null, 2)}`);
                }
                break;
                
            case 'running':
                contentParts.push(`🏃 Running ${status.tool}...`);
                break;
                
            case 'completed':
                contentParts.push(`✅ ${status.tool} completed`);
                if (status.duration) {
                    contentParts.push(`Duration: ${status.duration}ms`);
                }
                break;
                
            case 'failed':
                contentParts.push(`❌ ${status.tool} failed`);
                if (status.error) {
                    contentParts.push(`Error: ${status.error}`);
                }
                break;
        }
        
        toolEvent.content = contentParts.join('\n');
        toolEvent.created_at = Math.floor(Date.now() / 1000);
        toolEvent.pubkey = (await signer.user()).pubkey;
        await toolEvent.sign(signer);
        await toolEvent.publish();
        
        logger.debug("Published tool execution status", {
            tool: status.tool,
            status: status.status,
            eventId: toolEvent.id
        });
        
        return toolEvent;
    } catch (error) {
        logger.error("Failed to publish tool execution status", {
            tool: status.tool,
            status: status.status,
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}