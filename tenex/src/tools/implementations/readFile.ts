import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Tool, ToolExecutionContext, ToolResult } from "../types";
import { parseToolParams, resolveAndValidatePath } from "../utils";

const ReadFileArgsSchema = z.object({
  path: z.string().min(1, "path must be a non-empty string"),
});

export const readFileTool: Tool = {
  name: "read_file",
  description: "Read a file from the filesystem",
  parameters: [
    {
      name: "path",
      type: "string",
      description: "The file path to read (absolute or relative to project root)",
      required: true,
    },
  ],

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const parseResult = parseToolParams(ReadFileArgsSchema, params);
    if (!parseResult.success) {
      return parseResult.errorResult;
    }

    const { path } = parseResult.data;

    try {
      // Resolve path and ensure it's within project
      const fullPath = resolveAndValidatePath(path, context.projectPath);

      const content = await readFile(fullPath, "utf-8");
      
      // Track this file as read in conversation metadata for write_context_file security
      if (context.conversation) {
        if (!context.conversation.metadata.readFiles) {
          context.conversation.metadata.readFiles = [];
        }
        if (!context.conversation.metadata.readFiles.includes(fullPath)) {
          context.conversation.metadata.readFiles.push(fullPath);
        }
      }
      
      return {
        success: true,
        output: content,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: `Failed to read ${path}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
};
