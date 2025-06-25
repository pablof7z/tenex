import { Tool, ToolExecutionContext, ToolResult } from "../types.js";
import { z } from "zod";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { readFileSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
import { logger } from "@/utils/logger";
import { loadLLMRouter } from "@/llm";
import { Message } from "multi-llm-ts";


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

      // Generate temporary output file path
      const outputPath = join(tmpdir(), `repomix-${randomUUID()}.xml`);

      try {
        // Run repomix to generate the XML output
        logger.debug("Running repomix", { outputPath });
        execSync(`npx repomix --output "${outputPath}" --style xml`, {
          cwd: context.projectPath,
          stdio: "pipe",
        });

        // Read the generated XML
        const repoContent = readFileSync(outputPath, "utf-8");
        logger.debug("Repomix output generated", { 
          size: repoContent.length,
          lines: repoContent.split("\n").length 
        });

        // Prepare the prompt for the LLM
        const analysisPrompt = `You are analyzing a codebase. Here is the complete repository content in XML format from repomix:

<repository>
${repoContent}
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
            repoSize: repoContent.length,
          },
        };
      } finally {
        // Clean up temporary file
        try {
          unlinkSync(outputPath);
        } catch (e) {
          logger.warn("Failed to clean up temporary file", { outputPath, error: e });
        }
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