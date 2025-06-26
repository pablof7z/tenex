import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { loadLLMRouter } from "@/llm";
import { Message } from "multi-llm-ts";
import { generateRepomixOutput } from "@/utils/repomix";
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
