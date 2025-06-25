import { Tool, ToolExecutionContext, ToolResult } from "../types.js";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { generateInventory, inventoryExists } from "@/utils/inventory.js";
import { getProjectContext, isProjectContextInitialized } from "@/services";

const generateInventorySchema = z.object({
  force: z.boolean().optional().describe("Force regeneration even if inventory already exists"),
});

export const generateInventoryTool: Tool = {
  name: "generate_inventory",
  instructions: `Generate a comprehensive project inventory using repomix + LLM analysis.

This tool creates a detailed inventory of the codebase including:
- Project overview with technologies and architecture
- Directory structure and significant files with value propositions
- High-complexity modules with dedicated technical guides

Usage example:
<tool_use>
{"tool": "generate_inventory", "args": {}}
</tool_use>

<tool_use>
{"tool": "generate_inventory", "args": {"force": true}}
</tool_use>

The inventory is saved to context/INVENTORY.md and complex module guides are saved as separate files in the context/ directory.`,

  async run(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      const parsed = generateInventorySchema.parse(args);
      const { force = false } = parsed;

      logger.info("Agent requesting inventory generation", { force, projectPath: context.projectPath });

      // Check if inventory already exists
      const exists = await inventoryExists(context.projectPath);
      if (exists && !force) {
        return {
          success: true,
          output: "Project inventory already exists at context/INVENTORY.md. Use {\"force\": true} to regenerate it.",
          metadata: {
            inventoryExists: true,
            regenerated: false,
          },
        };
      }

      // Prepare options if agent context is available
      const options = context.agentSigner && context.conversationRootEventId ? {
        conversationRootEventId: context.conversationRootEventId,
        agentSigner: context.agentSigner,
      } : undefined;

      // Generate the inventory
      await generateInventory(context.projectPath, options);

      const message = exists 
        ? "✅ Project inventory regenerated successfully!"
        : "✅ Project inventory generated successfully!";

      return {
        success: true,
        output: `${message}

📋 Main inventory saved to context/INVENTORY.md
📚 Complex module guides (if any) saved to context/ directory

The inventory provides comprehensive information about the codebase structure, significant files, and architectural patterns to help with development tasks.`,
        metadata: {
          inventoryExists: true,
          regenerated: exists,
        },
      };
    } catch (error) {
      logger.error("Generate inventory tool failed", { error });
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};