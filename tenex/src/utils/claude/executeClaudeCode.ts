import { ClaudeCodeExecutor } from "@/tools/claude/ClaudeCodeExecutor";
import type { ClaudeCodeMessage } from "@/utils/claude/ClaudeParser";
import { logger } from "@/utils/logger";

export interface ClaudeExecutionOptions {
    prompt: string;
    projectPath: string;
    timeout?: number;
    onMessage?: (message: ClaudeCodeMessage) => void | Promise<void>;
    onError?: (error: Error) => void;
    onComplete?: (result: ClaudeExecutionResult) => void;
}

export interface ClaudeExecutionResult {
    success: boolean;
    sessionId?: string;
    totalCost?: number;
    messageCount?: number;
    duration?: number;
    error?: string;
    assistantMessages: string[];
}

/**
 * Execute Claude Code with the given options
 */
export async function executeClaudeCode(
    options: ClaudeExecutionOptions
): Promise<ClaudeExecutionResult> {
    try {
        logger.info("Executing Claude Code", {
            prompt: options.prompt,
            projectPath: options.projectPath,
        });

        const executor = new ClaudeCodeExecutor({
            prompt: options.prompt,
            projectPath: options.projectPath,
            timeout: options.timeout || 300000, // Default 5 minutes
            onMessage: options.onMessage,
            onError: options.onError,
            onComplete: options.onComplete,
        });

        const result = await executor.execute();

        return {
            success: result.success,
            sessionId: result.sessionId,
            totalCost: result.totalCost,
            messageCount: result.messageCount,
            duration: result.duration,
            error: result.error,
            assistantMessages: result.assistantMessages,
        };
    } catch (error) {
        logger.error("Claude Code execution failed", { error });
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            assistantMessages: [],
        };
    }
}