import { Tool, ToolExecutionContext, ToolResult } from "../types.js";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { loadLLMRouter } from "@/llm";
import { Message } from "multi-llm-ts";
import { generateRepomixOutput } from "@/utils/repomix.js";


const analyzeSchema = z.object({
  prompt: z.string().describe("The analysis prompt or question about the codebase"),
});

export const analyze: Tool = {
  name: "analyze",
  instructions: `Analyze the entire codebase using repomix to provide context-aware insights.

This tool uses repomix to create a compact representation of the entire codebase and sends it to an LLM along with your prompt for analysis. This is useful when you need a broad view of the system to answer specific questions.

Examples:
<tool_use>
{"tool": "analyze", "args": {"prompt": "What are the main architectural patterns used in this codebase?"}}
</tool_use>

<tool_use>
{"tool": "analyze", "args": {"prompt": "How does authentication work throughout the system?"}}
</tool_use>

<tool_use>
{"tool": "analyze", "args": {"prompt": "What are the key data flows in this application?"}}
</tool_use>`,

  async run(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      const parsed = analyzeSchema.parse(args);
      const { prompt } = parsed;

      logger.info("Running analyze tool", { prompt });

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
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};