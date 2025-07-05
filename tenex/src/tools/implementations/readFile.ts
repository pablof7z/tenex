import { readFile } from "node:fs/promises";
import type { EffectTool } from "../types";
import { suspend, createZodSchema } from "../types";
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
export const readFileTool: EffectTool<ReadFileInput, ReadFileOutput> = {
  brand: { _brand: "effect" },
  name: "read_file",
  description: "Read a file from the filesystem",
  
  parameters: createZodSchema(readFileSchema),

  execute: (input, context) => {
    const { path } = input.value;

    // Return an effect that describes the file read operation
    return suspend(async () => {
      try {
        // Resolve path and ensure it's within project
        const fullPath = resolveAndValidatePath(path, context.projectPath);

        const content = await readFile(fullPath, "utf-8");
        
        // Note: File tracking has been moved to the interpreter layer
        // This keeps the tool pure and focused on its primary responsibility
        
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
    });
  },
};