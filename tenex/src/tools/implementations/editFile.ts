import { readFile, writeFile } from 'fs/promises';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import { resolveAndValidatePath } from '../utils';

export const editFileTool: Tool = {
  name: "edit_file",
  instructions: `Edit a file by replacing specific text content.
Usage: {"tool": "edit_file", "args": {"path": "path/to/file.txt", "from": "old text", "to": "new text"}}
- The path can be absolute or relative to the project root
- The 'from' text must match exactly (including whitespace and indentation)
- Only replaces the first occurrence of the text
- Use this for surgical edits to existing files`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { path, from, to } = args as { path: string; from: string; to: string };
    try {
      if (!path) {
        return { success: false, error: 'Missing path parameter' };
      }
      if (from === undefined) {
        return { success: false, error: 'Missing from parameter' };
      }
      if (to === undefined) {
        return { success: false, error: 'Missing to parameter' };
      }

      // Resolve path and ensure it's within project
      const fullPath = resolveAndValidatePath(path, context.projectPath);
      
      // Read file
      const content = await readFile(fullPath, 'utf-8');
      
      // Check if the search pattern exists
      if (!content.includes(from)) {
        return { success: false, error: `Pattern not found in ${path}: ${from}` };
      }
      
      // Replace content
      const newContent = content.replace(from, to);
      
      // Write back
      await writeFile(fullPath, newContent, 'utf-8');
      return { success: true, output: `File edited: ${path}` };
    } catch (error: unknown) {
      return { success: false, error: `Failed to edit ${path}: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
};