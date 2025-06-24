import type { Tool, ToolExecutionContext, ToolResult } from '../types';

export const getTimeTool: Tool = {
  name: "get_time",
  instructions: `Get the current date and time.
Usage: {"tool": "get_time", "args": {}}
- Returns ISO 8601 formatted timestamp
- Useful for logging, timestamps, or time-based decisions`,
  
  async run(_args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
    const now = new Date();
    return { success: true, output: now.toISOString() };
  }
};