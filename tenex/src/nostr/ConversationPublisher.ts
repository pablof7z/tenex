import { getProjectContext } from "@/services";
import type { Conversation } from "@/conversations/types";
import type { Phase } from "@/conversations/phases";
import type { LLMMetadata } from "@/nostr/types";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { NDKEvent, NDKTag } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";

export async function publishAgentResponse(
    eventToReply: NDKEvent,
    content: string,
    nextAgent: string,
    signer: NDKPrivateKeySigner,
    llmMetadata?: LLMMetadata,
    additionalTags?: NDKTag[]
): Promise<NDKEvent> {
    const reply = eventToReply.reply();

    // Tag the project
    const projectCtx = getProjectContext();
    reply.tag(projectCtx.project);

    // Remove ALL existing p-tags first
    // NDK's reply() method adds p-tags automatically, so we need to clean them
    reply.tags = reply.tags.filter((tag) => tag[0] !== "p");

    // Only add p-tag if nextAgent is specified (non-empty)
    // This prevents tagging loops in chat mode
    if (nextAgent && nextAgent.trim() !== "") {
        reply.tag(["p", nextAgent]);
    }


    // Add LLM metadata if present
    if (llmMetadata) {
        reply.tag(["llm-model", llmMetadata.model]);
        reply.tag(["llm-cost-usd", llmMetadata.cost.toString()]);
        reply.tag(["llm-prompt-tokens", llmMetadata.promptTokens.toString()]);
        reply.tag(["llm-completion-tokens", llmMetadata.completionTokens.toString()]);
        reply.tag(["llm-total-tokens", llmMetadata.totalTokens.toString()]);
        if (llmMetadata.contextWindow) {
            reply.tag(["llm-context-window", llmMetadata.contextWindow.toString()]);
        }
        if (llmMetadata.maxCompletionTokens) {
            reply.tag(["llm-max-completion-tokens", llmMetadata.maxCompletionTokens.toString()]);
        }
        if (llmMetadata.systemPrompt) {
            reply.tag(["llm-system-prompt", llmMetadata.systemPrompt]);
        }
        if (llmMetadata.userPrompt) {
            reply.tag(["llm-user-prompt", llmMetadata.userPrompt]);
        }
        if (llmMetadata.rawResponse) {
            reply.tag(["llm-raw-response", llmMetadata.rawResponse]);
        }
    }

    // Add any additional custom tags
    if (additionalTags && additionalTags.length > 0) {
        for (const tag of additionalTags) {
            reply.tag(tag);
        }
    }

    reply.content = content;

    // Sign with the provided signer (agent or project)
    await reply.sign(signer);

    await reply.publish();

    // Log the actual content being published
    logger.debug("Published agent response content", {
        eventId: reply.id,
        contentLength: content.length,
        content,
    });

    return reply;
}

