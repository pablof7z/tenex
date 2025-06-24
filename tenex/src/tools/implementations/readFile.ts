import { readFile } from 'fs/promises';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import { resolveAndValidatePath } from '../utils';

export const readFileTool: Tool = {
  name: "read_file",
  instructions: `Read a file from the filesystem.
Usage: {"tool": "read_file", "args": {"path": "path/to/file.txt"}}
- The path can be absolute or relative to the project root
- Returns the file contents as a string
- Use this when you need to examine code, configuration files, or any text content`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { path } = args as { path: string };
    try {
      if (!path) {
        return { success: false, error: 'Missing path parameter' };
      }

      // Resolve path and ensure it's within project
      const fullPath = resolveAndValidatePath(path, context.projectPath);
      
      const content = await readFile(fullPath, 'utf-8');
      return { success: true, output: content };
    } catch (error: unknown) {
      return { success: false, error: `Failed to read ${path}: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
};