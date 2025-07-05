import { loadLLMRouter } from "@/llm";
import { logger } from "@/utils/logger";
import { generateRepomixOutput } from "@/utils/repomix";
import { Message } from "multi-llm-ts";
import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { parseToolParams } from "../utils";

const analyzeSchema = z.object({
  prompt: z.string().describe("The analysis prompt or question about the codebase"),
});

export const analyze: Tool = {
  name: "analyze",
  description: "Analyze the entire codebase using repomix to provide context-aware insights",
  parameters: [
    {
      name: "prompt",
      type: "string",
      description: "The analysis prompt or question about the codebase",
      required: true,
    },
  ],

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      const parseResult = parseToolParams(analyzeSchema, params);
      if (!parseResult.success) {
        return parseResult.errorResult;
      }
      const { prompt } = parseResult.data;

      logger.info("Running analyze tool", { prompt });

      // Publish custom typing indicator
      if (context.triggeringEvent && context.agent && context.conversation) {
        try {
          const { NostrPublisher } = await import("@/nostr/NostrPublisher");
          const { EVENT_KINDS } = await import("@/llm/types");
          const publisher = new NostrPublisher({
            conversation: context.conversation,
            agent: context.agent,
            triggeringEvent: context.triggeringEvent,
          });

          // Create a custom typing indicator event
          const typingEvent = publisher.createBaseReply();
          typingEvent.kind = EVENT_KINDS.TYPING_INDICATOR;
          typingEvent.content = `Analyzing repository to ${prompt.toLowerCase()}`;
          
          await typingEvent.sign(context.agent.signer!);
          await typingEvent.publish();

          logger.debug("Published custom typing indicator for analyze tool", {
            content: typingEvent.content,
            agent: context.agent.name,
          });
        } catch (error) {
          logger.warn("Failed to publish typing indicator for analyze tool", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const repomixResult = await generateRepomixOutput(context.projectPath);

      try {
        // Prepare the prompt for the LLM
        const analysisPrompt = `You are analyzing a codebase. Here is the complete repository content in XML format from repomix:

<repository>
${repomixResult.content}
</repository>

Based on this codebase, please answer the following:

${prompt}

Provide a clear, structured response focused on the specific question asked.`;

        // Call the LLM with the analyze-specific configuration
        const llmRouter = await loadLLMRouter(context.projectPath);
        const userMessage = new Message("user", analysisPrompt);
        const response = await llmRouter.complete({
          messages: [userMessage],
          options: {
            temperature: 0.3,
            maxTokens: 4000,
            configName: "defaults.analyze",
          },
        });

        logger.info("Analysis completed successfully");

        // Stop typing indicator
        if (context.triggeringEvent && context.agent && context.conversation) {
          try {
            const { NostrPublisher } = await import("@/nostr/NostrPublisher");
            const { EVENT_KINDS } = await import("@/llm/types");
            const publisher = new NostrPublisher({
              conversation: context.conversation,
              agent: context.agent,
              triggeringEvent: context.triggeringEvent,
            });

            // Create typing indicator stop event
            const stopTypingEvent = publisher.createBaseReply();
            stopTypingEvent.kind = EVENT_KINDS.TYPING_INDICATOR_STOP;
            stopTypingEvent.content = "";
            
            await stopTypingEvent.sign(context.agent.signer!);
            await stopTypingEvent.publish();

            logger.debug("Published typing indicator stop for analyze tool", {
              agent: context.agent.name,
            });
          } catch (error) {
            logger.warn("Failed to publish typing indicator stop for analyze tool", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          success: true,
          output: response.content || "",
          metadata: {
            repoSize: repomixResult.size,
          },
        };
      } finally {
        repomixResult.cleanup();
      }
    } catch (error) {
      logger.error("Analyze tool failed", { error });
      
      // Stop typing indicator on error
      if (context.triggeringEvent && context.agent && context.conversation) {
        try {
          const { NostrPublisher } = await import("@/nostr/NostrPublisher");
          const { EVENT_KINDS } = await import("@/llm/types");
          const publisher = new NostrPublisher({
            conversation: context.conversation,
            agent: context.agent,
            triggeringEvent: context.triggeringEvent,
          });

          const stopTypingEvent = publisher.createBaseReply();
          stopTypingEvent.kind = EVENT_KINDS.TYPING_INDICATOR_STOP;
          stopTypingEvent.content = "";
          
          await stopTypingEvent.sign(context.agent.signer!);
          await stopTypingEvent.publish();
        } catch (publishError) {
          logger.warn("Failed to publish typing indicator stop on error", {
            error: publishError instanceof Error ? publishError.message : String(publishError),
          });
        }
      }
      
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
