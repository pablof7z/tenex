import { readFile } from "node:fs/promises";
import type { Tool } from "../types";
import { createZodSchema } from "../types";
import { resolveAndValidatePath } from "../utils";
import { z } from "zod";

const readFileSchema = z.object({
  path: z.string().describe("The file path to read (absolute or relative to project root)"),
});

type ReadFileInput = z.infer<typeof readFileSchema>;
type ReadFileOutput = string;

/**
 * Read file tool - effect tool that reads files from filesystem
 * Performs I/O side effects
 */
export const readFileTool: Tool<ReadFileInput, ReadFileOutput> = {
  name: "read_file",
  description: "Read a file from the filesystem",

  parameters: createZodSchema(readFileSchema),

  execute: async (input, context) => {
    const { path } = input.value;

    try {
      // Resolve path and ensure it's within project
      const fullPath = resolveAndValidatePath(path, context.projectPath);

      const content = await readFile(fullPath, "utf-8");

      // Track file read in conversation metadata if path starts with context/
      if (path.startsWith("context/") && context.conversationManager) {
        const currentMetadata = context.conversation.metadata;
        const readFiles = currentMetadata.readFiles || [];
        
        // Only add if not already tracked
        if (!readFiles.includes(path)) {
          await context.conversationManager.updateMetadata(context.conversationId, {
            readFiles: [...readFiles, path],
          });
        }
      }

      return { ok: true, value: content };
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          kind: "execution" as const,
          tool: "read_file",
          message: `Failed to read ${path}: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        },
      };
    }
  },
};
