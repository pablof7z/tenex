import { loadLLMRouter } from "@/llm";
import { logger } from "@/utils/logger";
import { generateRepomixOutput } from "@/utils/repomix";
import { Message } from "multi-llm-ts";
import { z } from "zod";
import type { EffectTool } from "../types";
import { createZodSchema, suspend } from "../types";

const analyzeSchema = z.object({
  prompt: z.string().min(1).describe("The analysis prompt or question about the codebase"),
});

interface AnalyzeInput {
  prompt: string;
}

interface AnalyzeOutput {
  analysis: string;
  repoSize: number;
}

export const analyze: EffectTool<AnalyzeInput, AnalyzeOutput> = {
  brand: { _brand: "effect" },
  name: "analyze",
  description: "Analyze the entire codebase using repomix to provide context-aware insights",

  parameters: createZodSchema(analyzeSchema),

  execute: (input, context) =>
    suspend(async () => {
      const { prompt } = input.value;

      logger.info("Running analyze tool", { prompt });

      // Publish custom typing indicator (disabled for now - ExecutionContext doesn't have these properties)
      // TODO: Add typing indicator support

      let repomixResult;
      try {
        repomixResult = await generateRepomixOutput(context.projectPath);
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "execution" as const,
            tool: "analyze",
            message: `Failed to generate repomix output: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          },
        };
      }

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

        // Stop typing indicator (disabled for now)
        // TODO: Add typing indicator support

        return {
          ok: true,
          value: {
            analysis: response.content || "",
            repoSize: repomixResult.size,
          },
        };
      } catch (error) {
        logger.error("Analyze tool failed", { error });

        // Stop typing indicator on error (disabled for now)
        // TODO: Add typing indicator support

        return {
          ok: false,
          error: {
            kind: "execution" as const,
            tool: "analyze",
            message: error instanceof Error ? error.message : String(error),
            cause: error,
          },
        };
      } finally {
        repomixResult.cleanup();
      }
    }),
};
