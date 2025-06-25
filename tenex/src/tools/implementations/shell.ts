import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';

const execAsync = promisify(exec);

export const shellTool: Tool = {
  name: "shell",
  instructions: `Execute a shell command in the project directory.

Usage example:
<tool_use>
{"tool": "shell", "args": {"command": "npm install"}}
</tool_use>

- Commands are executed in the project root directory
- Environment includes NO_COLOR=1 to avoid ANSI escape codes
- Use this for running build commands, tests, git operations, etc.
- Be careful with destructive commands`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { command } = args as { command: string };
    try {
      if (!command) {
        return { success: false, error: 'Missing command parameter' };
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: context.projectPath,
        env: { ...process.env, NO_COLOR: '1' }
      });
      
      return { success: true, output: stdout || stderr };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};