import { readFile } from 'fs/promises';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import { resolveAndValidatePath } from '../utils';

const ReadFileArgsSchema = z.object({
  path: z.string().min(1, 'path must be a non-empty string')
});

export const readFileTool: Tool = {
  name: "read_file",
  instructions: `Read a file from the filesystem.

Usage example:
<tool_use>
{"tool": "read_file", "args": {"path": "path/to/file.txt"}}
</tool_use>

- The path can be absolute or relative to the project root
- Returns the file contents as a string
- Use this when you need to examine code, configuration files, or any text content`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const parsed = ReadFileArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: `Invalid arguments: ${parsed.error.issues.map(i => i.message).join(', ')}` };
    }
    
    const { path } = parsed.data;

    try {
      // Resolve path and ensure it's within project
      const fullPath = resolveAndValidatePath(path, context.projectPath);
      
      const content = await readFile(fullPath, 'utf-8');
      return { success: true, output: content };
    } catch (error: unknown) {
      return { success: false, error: `Failed to read ${path}: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
};