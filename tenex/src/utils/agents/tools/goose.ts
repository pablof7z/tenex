import { spawn } from "node:child_process";
import type { ToolContext, ToolDefinition, ToolResult } from "./types";

interface GooseParams {
  task: string;
  recipe?: {
    instructions?: string;
    extensions?: string[];
  };
}

export const goose: ToolDefinition = {
  name: "goose",
  description: `Execute complex tasks with Goose AI agent. Use this tool when you need to:
- Test web applications (browser automation)
- Perform multi-step workflows across different systems
- Interact with external APIs or services
- Handle tasks that require visual inspection or UI interaction

Examples:
- "Test if the login page works correctly"
- "Take screenshots of all main pages"
- "Check if the API endpoints return valid data"
- "Navigate through the checkout flow and verify each step"

Keep tasks focused and specific. Goose will use appropriate tools (browser, API clients, etc.) based on the task.`,

  parameters: [
    {
      name: "task",
      type: "string",
      description: "Clear description of what you want Goose to do",
      required: true,
    },
    {
      name: "recipe",
      type: "object",
      description: "Optional recipe configuration",
      required: false,
      properties: {
        instructions: {
          name: "instructions",
          type: "string",
          description: "Additional instructions or context for Goose",
        },
        extensions: {
          name: "extensions",
          type: "array",
          description: "MCP extensions to enable (e.g., 'puppeteer', 'github')",
          items: {
            name: "extension",
            type: "string",
            description: "Extension name",
          },
        },
      },
    },
  ],

  execute: async (params, context?: ToolContext): Promise<ToolResult> => {
    const { task, recipe } = params as unknown as GooseParams;
    return new Promise((resolve) => {
      const args = ["run"];

      // Build recipe if provided
      if (recipe) {
        const fullRecipe = {
          version: "1.0.0",
          title: "TENEX Agent Task",
          description: task,
          instructions: recipe.instructions || task,
          extensions: recipe.extensions || [],
        };

        args.push("--recipe", JSON.stringify(fullRecipe));
      } else {
        // Simple task execution
        args.push(task);
      }

      const gooseProcess = spawn("goose", args, {
        env: {
          ...process.env,
          GOOSE_LOG_LEVEL: "info",
        },
      });

      let output = "";
      let errorOutput = "";

      gooseProcess.stdout.on("data", (data) => {
        const chunk = data.toString();
        output += chunk;

        // Log progress (no onProgress method in ToolContext)
        // context?.onProgress?.(chunk.trim());
      });

      gooseProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      gooseProcess.on("error", (error) => {
        resolve({
          success: false,
          output: "",
          error: `Failed to start Goose: ${error.message}. Make sure Goose is installed.`,
        });
      });

      gooseProcess.on("exit", (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: output.trim(),
          });
        } else {
          resolve({
            success: false,
            output: output.trim(),
            error: errorOutput || `Goose exited with code ${code}`,
          });
        }
      });

      // Basic timeout protection (5 minutes)
      setTimeout(
        () => {
          gooseProcess.kill("SIGTERM");
          resolve({
            success: false,
            output: output.trim(),
            error: "Goose execution timed out after 5 minutes",
          });
        },
        5 * 60 * 1000
      );
    });
  },
};
