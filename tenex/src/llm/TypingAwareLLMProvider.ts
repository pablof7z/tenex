import type { NDKSigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

const llmLogger = logger.forModule("llm");
import type { LLMConfig } from "@/utils/agents/types";
import type { EventContext, NostrPublisher } from "../agents/core/types";
import type { LLMContext, LLMMessage, LLMProvider, LLMResponse, ProviderTool } from "./types";

/**
 * A wrapper around any LLM provider that automatically publishes typing indicators
 * with the actual system and user prompts being sent to the LLM.
 *
 * This ensures consistency between what we show in typing indicators and what
 * we actually send to the LLM, solving the architectural issue where typing
 * indicators were manually published with potentially incorrect prompts.
 */
export class TypingAwareLLMProvider implements LLMProvider {
  constructor(
    private baseProvider: LLMProvider,
    private publisher: NostrPublisher,
    private agentName: string,
    private signer: NDKSigner
  ) {}

  async generateResponse(
    messages: LLMMessage[],
    config: LLMConfig,
    context?: LLMContext,
    tools?: ProviderTool[]
  ): Promise<LLMResponse> {
    // Extract actual prompts being sent to LLM
    const systemPrompt = messages.find((m) => m.role === "system")?.content;
    const userPrompt = this.extractUserPrompt(messages);

    // Build event context from LLM context if available
    const eventContext = this.buildEventContext(context);

    // Publish typing start indicator if we have the necessary context
    if (eventContext && this.shouldPublishTypingIndicator(context)) {
      try {
        await this.publisher.publishTypingIndicator(
          this.agentName,
          true,
          eventContext,
          this.signer,
          {
            systemPrompt: systemPrompt || undefined,
            userPrompt: userPrompt || undefined,
          }
        );
      } catch (error) {
        // Don't fail the LLM call if typing indicator fails
        llmLogger.debug(`Failed to publish typing start indicator: ${error}`, "verbose");
      }
    }

    try {
      // Call the underlying LLM provider
      const response = await this.baseProvider.generateResponse(messages, config, context, tools);

      // Preserve all properties from the response (including toolCalls, hasNativeToolCalls, etc.)
      return response;
    } finally {
      // Always publish typing stop indicator if we published start
      if (eventContext && this.shouldPublishTypingIndicator(context)) {
        try {
          await this.publisher.publishTypingIndicator(
            this.agentName,
            false,
            eventContext,
            this.signer
          );
        } catch (error) {
          // Don't fail if typing stop fails
          llmLogger.debug(`Failed to publish typing stop indicator: ${error}`, "verbose");
        }
      }
    }
  }

  /**
   * Extract the most recent user prompt from the message history
   */
  private extractUserPrompt(messages: LLMMessage[]): string | undefined {
    // Find the last user message (most recent prompt)
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return messages[i].content;
      }
    }
    return undefined;
  }

  /**
   * Build EventContext from LLMContext
   */
  private buildEventContext(context?: LLMContext): EventContext | undefined {
    if (!context?.projectEvent || !context.rootEventId) {
      return undefined;
    }

    return {
      rootEventId: context.rootEventId,
      projectId: context.projectEvent.dTag || "",
      projectEvent: context.projectEvent,
      originalEvent: context.projectEvent, // Default to project event if no specific event
    };
  }

  /**
   * Determine if we should publish typing indicators based on available context
   */
  private shouldPublishTypingIndicator(context?: LLMContext): boolean {
    // Only publish if we have the necessary Nostr context
    return !!(context?.projectEvent && context.rootEventId && context.ndk);
  }
}
