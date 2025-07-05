import { exec } from "node:child_process";
import { promisify } from "node:util";
import { generateInventory, inventoryExists } from "@/utils/inventory";
import { logger } from "@/utils/logger";
import { z } from "zod";
import type { EffectTool } from "../types";
import { createZodSchema, suspend } from "../types";

const execAsync = promisify(exec);

const generateInventorySchema = z.object({
  force: z.boolean().optional().describe("Force regeneration even if inventory already exists"),
});

interface GenerateInventoryInput {
  force?: boolean;
}

interface GenerateInventoryOutput {
  message: string;
  inventoryExists: boolean;
  regenerated: boolean;
}

export const generateInventoryTool: EffectTool<GenerateInventoryInput, GenerateInventoryOutput> = {
  brand: { _brand: "effect" },
  name: "generate_inventory",
  description: "Generate a comprehensive project inventory using repomix + LLM analysis",
  
  parameters: createZodSchema(generateInventorySchema),

  execute: (input, context) => suspend(async () => {
    const { force = false } = input.value;

    logger.info("Agent requesting inventory generation", {
      force,
      projectPath: context.projectPath,
    });

    // Check if inventory already exists
    const exists = await inventoryExists(context.projectPath);
    if (exists && !force) {
      return {
        ok: true,
        value: {
          message: 'Project inventory already exists at context/INVENTORY.md. Use {"force": true} to regenerate it.',
          inventoryExists: true,
          regenerated: false,
        },
      };
    }

    // Check for recently modified files using git status
    let focusFiles: Array<{ path: string; status: string }> | undefined;
    try {
      const { stdout } = await execAsync("git status --porcelain", { cwd: context.projectPath });
      if (stdout.trim()) {
        focusFiles = stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => ({
            status: line.substring(0, 2).trim(),
            path: line.substring(3),
          }));

        logger.info("Detected modified files for inventory focus", {
          count: focusFiles.length,
          files: focusFiles.slice(0, 10), // Log first 10 files
        });
      }
    } catch (error) {
      logger.warn("Failed to get git status for focus files", { error });
      // Continue without focus files
    }

    try {
      // Prepare options if agent context is available
      // TODO: Get agent and conversationRootEventId from context
      const options = { focusFiles };

      // Generate the inventory
      await generateInventory(context.projectPath, options);

      const statusMessage = exists
        ? "✅ Project inventory regenerated successfully!"
        : "✅ Project inventory generated successfully!";

      const message = `${statusMessage}

📋 Main inventory saved to context/INVENTORY.md
📚 Complex module guides (if any) saved to context/ directory

The inventory provides comprehensive information about the codebase structure, significant files, and architectural patterns to help with development tasks.`;

      return {
        ok: true,
        value: {
          message,
          inventoryExists: true,
          regenerated: exists,
        },
      };
    } catch (error) {
      logger.error("Generate inventory tool failed", { error });
      return {
        ok: false,
        error: {
          kind: "execution" as const,
          tool: "generate_inventory",
          message: error instanceof Error ? error.message : String(error),
          cause: error,
        },
      };
    }
  }),
};