import { ClaudeCodeExecutor } from '../claude/ClaudeCodeExecutor';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';

export const claudeCodeTool: Tool = {
  name: "claude_code",
  instructions: `Use Claude Code (CLI tool) to perform complex coding tasks.
Usage: {"tool": "claude_code", "args": {"prompt": "implement a fibonacci function", "mode": "run"}}
- mode can be "run" (default) or "plan"
- "run" mode executes the task immediately
- "plan" mode creates a plan without executing
- Use this for complex multi-file changes, refactoring, or when you need another AI assistant`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const { prompt, mode } = args as { prompt: string; mode?: 'run' | 'plan' };
    try {
      if (!prompt) {
        return { success: false, error: 'Missing prompt parameter' };
      }

      const executor = new ClaudeCodeExecutor({
        prompt,
        projectPath: context.projectPath
      });
      
      const result = await executor.execute();
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
};