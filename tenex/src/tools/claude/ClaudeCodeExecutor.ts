import type { SDKMessage } from "@anthropic-ai/claude-code";
import { ClaudeStreamHandler, type StreamMetrics } from "./ClaudeStreamHandler";
import { logger } from "@/utils/logger";

export interface ClaudeCodeExecutorOptions {
    prompt: string;
    projectPath: string;
    timeout?: number;
    abortSignal?: AbortSignal;
    onMessage?: (message: SDKMessage) => void | Promise<void>;
    onError?: (error: Error) => void;
    onComplete?: (result: ClaudeCodeResult) => void;
}

export interface ClaudeCodeResult {
    success: boolean;
    output: string;
    error?: string;
    sessionId?: string;
    totalCost?: number;
    messageCount?: number;
    duration?: number;
    assistantMessages: string[];
}

/**
 * Executes Claude Code using the official SDK
 * Single Responsibility: Execute Claude Code and stream messages
 */
export class ClaudeCodeExecutor {
    private startTime: number;
    private abortController: AbortController;

    constructor(private options: ClaudeCodeExecutorOptions) {
        this.startTime = Date.now();
        this.abortController = new AbortController();
        
        // Link external abort signal if provided
        if (options.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
                this.abortController.abort(options.abortSignal!.reason);
            });
        }
    }

    async execute(): Promise<ClaudeCodeResult> {
        let result: { messages: SDKMessage[], metrics: StreamMetrics } | undefined;
        let error: string | undefined;

        try {
            // Set timeout if specified
            if (this.options.timeout) {
                const timeoutId = setTimeout(() => {
                    this.abortController.abort(new Error('Timeout'));
                }, this.options.timeout);
                
                // Clear timeout if aborted early
                this.abortController.signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                });
            }

            // Use shared stream handler
            result = await ClaudeStreamHandler.processStream({
                prompt: this.options.prompt,
                projectPath: this.options.projectPath,
                abortController: this.abortController,
                onMessage: this.options.onMessage,
            });

            const duration = Date.now() - this.startTime;
            const executionResult: ClaudeCodeResult = {
                success: true,
                output: result.messages.map(m => JSON.stringify(m)).join('\n'),
                sessionId: result.metrics.sessionId,
                totalCost: result.metrics.totalCost,
                messageCount: result.metrics.messageCount,
                duration,
                assistantMessages: result.metrics.assistantMessages,
            };

            this.options.onComplete?.(executionResult);
            return executionResult;

        } catch (err) {
            const duration = Date.now() - this.startTime;
            error = err instanceof Error ? err.message : 'Unknown error';
            
            this.options.onError?.(err as Error);

            return {
                success: false,
                output: result?.messages.map(m => JSON.stringify(m)).join('\n') || '',
                error,
                sessionId: result?.metrics?.sessionId,
                totalCost: result?.metrics?.totalCost || 0,
                messageCount: result?.metrics?.messageCount || 0,
                duration,
                assistantMessages: result?.metrics?.assistantMessages || [],
            };
        }
    }

    kill(): void {
        this.abortController.abort();
    }

    isRunning(): boolean {
        return !this.abortController.signal.aborted;
    }
}