import { z } from 'zod';
import { TaskPublisher } from '@/nostr/TaskPublisher';
import { getNDK } from '@/nostr/ndkClient';
import type { Tool, ToolExecutionContext, ToolResult } from '../types';

const ClaudeCodeArgsSchema = z.object({
  prompt: z.string().min(1, 'prompt must be a non-empty string'),
  mode: z.enum(['run', 'plan']).optional()
});

export const claudeCodeTool: Tool = {
  name: "claude_code",
  instructions: `Use Claude Code (CLI tool) to perform complex coding tasks.
Usage: {"tool": "claude_code", "args": {"prompt": "implement a fibonacci function", "mode": "run"}}
- mode can be "run" (default) or "plan"
- "run" mode executes the task immediately
- "plan" mode creates a plan without executing
- Use this for complex multi-file changes, refactoring, or when you need another AI assistant`,
  
  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const parsed = ClaudeCodeArgsSchema.safeParse(args);
      if (!parsed.success) {
        return { success: false, error: `Invalid arguments: ${parsed.error.issues.map(i => i.message).join(', ')}` };
      }
      
      const { prompt, mode = 'run' } = parsed.data;

      // Use TaskPublisher to ensure all claude_code executions are tracked
      const ndk = getNDK();
      const taskPublisher = new TaskPublisher(ndk);
      
      // Get conversation metadata for branch and conversation root
      const branch = context.conversation?.metadata?.branch;
      const conversationRootEventId = context.conversation?.history[0]?.id;
      
      // Execute through TaskPublisher for consistent Nostr tracking
      const { task, result } = await taskPublisher.executeWithTask({
        prompt,
        projectPath: context.projectPath,
        title: `Claude Code ${mode === 'plan' ? 'Planning' : 'Execution'} (via ${context.agentName})`,
        branch,
        conversationRootEventId
      });

      // Convert ClaudeCodeResult to ToolResult
      if (result.success) {
        return {
          success: true,
          output: result.assistantMessages.join('\n\n'),
          metadata: {
            sessionId: result.sessionId,
            totalCost: result.totalCost,
            messageCount: result.messageCount,
            duration: result.duration,
            taskId: task.id
          }
        };
      } else {
        return {
          success: false,
          error: result.error || 'Claude Code execution failed',
          metadata: {
            sessionId: result.sessionId,
            taskId: task.id
          }
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
};