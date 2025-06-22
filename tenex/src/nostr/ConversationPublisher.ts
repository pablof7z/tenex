import type { ProjectContext } from "@/runtime";
import type { Conversation, Phase } from "@/types/conversation";
import type { LLMMetadata } from "@/types/nostr";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent, NDKPrivateKeySigner, NDKTag } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";

export class ConversationPublisher {
  constructor(
    private projectContext: ProjectContext,
    private ndk: NDK
  ) {}

  async publishAgentResponse(
    eventToReply: NDKEvent,
    content: string,
    nextAgent: string,
    signer: NDKPrivateKeySigner,
    llmMetadata?: LLMMetadata
  ): Promise<NDKEvent> {
    const reply = eventToReply.reply();

    // Remove ALL existing p-tags first
    // NDK's reply() method adds p-tags automatically, so we need to clean them
    reply.tags = reply.tags.filter((tag) => tag[0] !== "p");

    // Only add p-tag if nextAgent is specified (non-empty)
    // This prevents tagging loops in chat mode
    if (nextAgent && nextAgent.trim() !== "") {
      reply.tag(["p", nextAgent]);
    }

    console.log("Replying to event", {
      eventPubkey: eventToReply.pubkey,
      myPubkey: signer.pubkey,
      nextAgent,
    });

    // Tag the project
    reply.tag(this.projectContext.projectEvent);

    // Add LLM metadata if present
    if (llmMetadata) {
      reply.tag(["llm-model", llmMetadata.model]);
      reply.tag(["llm-cost-usd", llmMetadata.cost.toString()]);
      reply.tag(["llm-prompt-tokens", llmMetadata.promptTokens.toString()]);
      reply.tag(["llm-completion-tokens", llmMetadata.completionTokens.toString()]);
      reply.tag(["llm-total-tokens", llmMetadata.totalTokens.toString()]);
      reply.tag(["llm-system-prompt", llmMetadata.systemPromptHash || ""]);
      reply.tag(["llm-user-prompt", llmMetadata.userPromptHash || ""]);
    }

    reply.content = content;

    // Sign with the provided signer (agent or project)
    await reply.sign(signer);

    await reply.publish();

    logger.info("Published agent response", {
      id: reply.id,
      nextAgent,
      hasLLMMetadata: !!llmMetadata,
      author: reply.pubkey,
    });

    // Log the actual content being published
    logger.debug("Published agent response content", {
      eventId: reply.id,
      contentLength: content.length,
      content,
    });

    return reply;
  }

  async publishPhaseTransition(
    conversation: Conversation,
    newPhase: Phase,
    context: string,
    signer: NDKPrivateKeySigner,
    triggeringEvent: NDKEvent,
    nextResponder?: string
  ): Promise<NDKEvent> {
    const event = triggeringEvent.reply();

    // Tag the project
    event.tag(this.projectContext.projectEvent);

    // Phase transition tags
    event.tag(["phase-transition", `${conversation.phase}-to-${newPhase}`]);
    event.tag(["phase", newPhase]);

    // P-tag next responder if specified
    if (nextResponder) {
      event.tag(["p", nextResponder]);
    }

    event.content = `Phase transition: Moving from ${conversation.phase} to ${newPhase}\n\n${context}`;

    // Sign with the provided signer
    await event.sign(signer);

    await event.publish();

    logger.info("Published phase transition", {
      id: event.id,
      from: conversation.phase,
      to: newPhase,
      author: event.pubkey,
    });

    return event;
  }

  async publishProjectResponse(
    eventToReply: NDKEvent,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<NDKEvent> {
    const reply = eventToReply.reply();

    // Remove existing p-tags (project is responding)
    reply.tags = reply.tags.filter((tag) => tag[0] !== "p");

    // Tag the project
    reply.tag(this.projectContext.projectEvent);

    // Add any custom metadata tags
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        reply.tag([key, String(value)]);
      }
    }

    reply.content = content;

    // Sign with project signer
    await reply.sign(this.projectContext.projectSigner);

    await reply.publish();

    logger.info("Published project response", {
      id: reply.id,
      author: reply.pubkey,
    });

    return reply;
  }
}
