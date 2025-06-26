import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { generateInventory, inventoryExists } from "@/utils/inventory";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const generateInventorySchema = z.object({
    force: z.boolean().optional().describe("Force regeneration even if inventory already exists"),
});

export const generateInventoryTool: Tool = {
    name: "generate_inventory",
    description: "Generate a comprehensive project inventory using repomix + LLM analysis",
    parameters: [
        {
            name: "force",
            type: "boolean",
            description: "Force regeneration even if inventory already exists",
            required: true,
        },
    ],

    async execute(
        params: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<ToolResult> {
        try {
            const parsed = generateInventorySchema.parse(params);
            const { force = false } = parsed;

            logger.info("Agent requesting inventory generation", {
                force,
                projectPath: context.projectPath,
            });

            // Check if inventory already exists
            const exists = await inventoryExists(context.projectPath);
            if (exists && !force) {
                return {
                    success: true,
                    output: 'Project inventory already exists at context/INVENTORY.md. Use {"force": true} to regenerate it.',
                    metadata: {
                        inventoryExists: true,
                        regenerated: false,
                    },
                };
            }

            // Check for recently modified files using git status
            let focusFiles: Array<{ path: string; status: string }> | undefined;
            try {
                const { stdout } = await execAsync('git status --porcelain', { cwd: context.projectPath });
                if (stdout.trim()) {
                    focusFiles = stdout.trim().split('\n')
                        .filter(line => line.length > 0)
                        .map(line => ({
                            status: line.substring(0, 2).trim(),
                            path: line.substring(3)
                        }));
                    
                    logger.info("Detected modified files for inventory focus", {
                        count: focusFiles.length,
                        files: focusFiles.slice(0, 10) // Log first 10 files
                    });
                }
            } catch (error) {
                logger.warn("Failed to get git status for focus files", { error });
                // Continue without focus files
            }

            // Prepare options if agent context is available
            const options =
                context.agentSigner && context.conversationRootEventId
                    ? {
                          conversationRootEventId: context.conversationRootEventId,
                          agentSigner: context.agentSigner,
                          focusFiles
                      }
                    : { focusFiles };

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
