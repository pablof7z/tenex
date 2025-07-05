import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { parseToolParams } from "../utils";

// No longer using in-memory tracking - now persisted in conversation metadata

const WriteContextFileArgsSchema = z.object({
  filename: z.string().min(1, "filename must be a non-empty string"),
  content: z.string().min(1, "content must be a non-empty string"),
});

export const writeContextFileTool: Tool = {
  name: "write_context_file",
  description: "Write or update a specification file in the context/ directory. You must have read this file recently before writing to it.",
  parameters: [
    {
      name: "filename",
      type: "string",
      description: "The filename to write in the context/ directory (e.g., 'PROJECT.md', 'REQUIREMENTS.md')",
      required: true,
    },
    {
      name: "content",
      type: "string",
      description: "The content to write to the file",
      required: true,
    },
  ],

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    // Only project-manager can use this tool
    if (context.agent.role !== "Project Knowledge Expert") {
      return {
        success: false,
        error: "Only the project-manager agent can use the write_context_file tool",
      };
    }

    const parseResult = parseToolParams(WriteContextFileArgsSchema, params);
    if (!parseResult.success) {
      return parseResult.errorResult;
    }

    const { filename, content } = parseResult.data;

    // Validate filename - no path traversal allowed
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return {
        success: false,
        error: "Invalid filename. Must not contain path separators or '..'",
      };
    }

    // Only allow markdown files
    if (!filename.endsWith(".md")) {
      return {
        success: false,
        error: "Only markdown files (.md) can be written to the context directory",
      };
    }

    try {
      // Construct the full path
      const contextDir = path.join(context.projectPath, "context");
      const fullPath = path.join(contextDir, filename);

      // Check if this file was recently read from persisted conversation metadata
      const wasRecentlyRead = context.conversation?.metadata.readFiles?.includes(fullPath) ?? false;

      // If file exists and wasn't recently read, deny access
      if (!wasRecentlyRead) {
        // Check if file exists
        const { access } = await import("node:fs/promises");
        try {
          await access(fullPath);
          // File exists but wasn't read recently
          return {
            success: false,
            error: `You must read the file 'context/${filename}' before writing to it. Use the read_file tool first.`,
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
        success: true,
        output: `Successfully wrote to context/${filename}`,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
};