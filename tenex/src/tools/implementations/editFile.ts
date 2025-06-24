import { readFile, writeFile } from 'fs/promises';
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import { resolveAndValidatePath } from '../utils';

const EditFileArgsSchema = z.object({
  path: z.string().min(1, 'path must be a non-empty string'),
  from: z.string(),
  to: z.string()
});

export const editFileTool: Tool = {
  name: "edit_file",
  instructions: `Edit a file by replacing specific text content.
Usage: {"tool": "edit_file", "args": {"path": "path/to/file.txt", "from": "old text", "to": "new text"}}
- The path can be absolute or relative to the project root
- The 'from' text must match exactly (including whitespace and indentation)
- Only replaces the first occurrence of the text
- Use this for surgical edits to existing files`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const parsed = EditFileArgsSchema.safeParse(args);
      if (!parsed.success) {
        return { success: false, error: `Invalid arguments: ${parsed.error.issues.map(i => i.message).join(', ')}` };
      }
      
      const { path, from, to } = parsed.data;

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
      return { success: false, error: `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
};