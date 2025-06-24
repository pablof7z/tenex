import { writeFile } from 'fs/promises';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import { resolveAndValidatePath } from '../utils';

export const writeFileTool: Tool = {
  name: "write_file",
  instructions: `Write content to a file. Creates the file if it doesn't exist, overwrites if it does.
Usage: {"tool": "write_file", "args": {"path": "path/to/file.txt", "content": "file contents"}}
- The path can be absolute or relative to the project root
- Creates parent directories if they don't exist
- Use this to create new files or completely replace existing file contents`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { path, content } = args as { path: string; content: string };
    try {
      if (!path) {
        return { success: false, error: 'Missing path parameter' };
      }
      if (content === undefined) {
        return { success: false, error: 'Missing content parameter' };
      }

      // Resolve path and ensure it's within project
      const fullPath = resolveAndValidatePath(path, context.projectPath);
      
      // Create parent directory if it doesn't exist
      await mkdir(dirname(fullPath), { recursive: true });
      
      await writeFile(fullPath, content, 'utf-8');
      return { success: true, output: `File written: ${path}` };
    } catch (error: unknown) {
      return { success: false, error: `Failed to write ${path}: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
};