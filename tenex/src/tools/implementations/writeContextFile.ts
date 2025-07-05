import { mkdir, writeFile, access } from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import type { EffectTool, ToolError } from "../types";
import { createZodSchema, suspend } from "../types";

const WriteContextFileArgsSchema = z.object({
  filename: z.string().min(1, "filename must be a non-empty string"),
  content: z.string().min(1, "content must be a non-empty string"),
});

interface WriteContextFileInput {
  filename: string;
  content: string;
}

interface WriteContextFileOutput {
  message: string;
}

export const writeContextFileTool: EffectTool<WriteContextFileInput, WriteContextFileOutput> = {
  brand: { _brand: "effect" },
  name: "write_context_file",
  description:
    "Write or update a specification file in the context/ directory. You must have read this file recently before writing to it.",

  parameters: createZodSchema(WriteContextFileArgsSchema),

  execute: (input, context) =>
    suspend<ToolError, WriteContextFileOutput>(async () => {
      const { filename, content } = input.value;

      // TODO: Implement agent role check when available in context
      // Only project-manager should use this tool

      // Validate filename - no path traversal allowed
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return {
          ok: false,
          error: {
            kind: "validation" as const,
            field: "filename",
            message: "Invalid filename. Must not contain path separators or '..'",
          },
        };
      }

      // Only allow markdown files
      if (!filename.endsWith(".md")) {
        return {
          ok: false,
          error: {
            kind: "validation" as const,
            field: "filename",
            message: "Only markdown files (.md) can be written to the context directory",
          },
        };
      }

      try {
        // Construct the full path
        const contextDir = path.join(context.projectPath, "context");
        const fullPath = path.join(contextDir, filename);

        // Check if this file was recently read from persisted conversation metadata
        // TODO: Get conversation from context
        const wasRecentlyRead = false;

        // If file exists and wasn't recently read, deny access
        if (!wasRecentlyRead) {
          // Check if file exists
          try {
            await access(fullPath);
            // File exists but wasn't read recently
            return {
              ok: false,
              error: {
                kind: "validation" as const,
                field: "filename",
                message: `You must read the file 'context/${filename}' before writing to it. Use the read_file tool first.`,
              },
            };
          } catch {
            // File doesn't exist, allow creation
          }
        }

        // Ensure context directory exists
        await mkdir(contextDir, { recursive: true });

        // Write the file
        await writeFile(fullPath, content, "utf-8");

        return {
          ok: true,
          value: {
            message: `Successfully wrote to context/${filename}`,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "execution" as const,
            tool: "write_context_file",
            message: `Failed to write file: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        };
      }
    }),
};
