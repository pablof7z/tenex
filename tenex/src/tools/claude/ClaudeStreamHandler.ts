import { query, type SDKMessage } from "@anthropic-ai/claude-code";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages/messages";
import { logger } from "@/utils/logger";

export interface StreamMetrics {
    sessionId?: string;
    totalCost: number;
    messageCount: number;
    assistantMessages: string[];
}

export interface StreamOptions {
    prompt: string;
    projectPath: string;
    abortController: AbortController;
    onMessage?: (message: SDKMessage) => void | Promise<void>;
}

/**
 * Shared stream handling logic for Claude Code SDK
 * Single Responsibility: Process SDK message streams and extract metrics
 */
export class ClaudeStreamHandler {
    /**
     * Process a Claude Code stream and extract metrics
     */
    static async processStream(options: StreamOptions): Promise<{ messages: SDKMessage[], metrics: StreamMetrics }> {
        const messages: SDKMessage[] = [];
        const metrics: StreamMetrics = {
            totalCost: 0,
            messageCount: 0,
            assistantMessages: [],
        };

        for await (const message of query({
            prompt: options.prompt,
            abortController: options.abortController,
            options: {
                cwd: options.projectPath,
                permissionMode: 'bypassPermissions',
            }
        })) {
            messages.push(message);

            // Extract metrics from messages
            if (!metrics.sessionId && message.session_id) {
                metrics.sessionId = message.session_id;
            }

            if (message.type === 'assistant') {
                metrics.messageCount++;
                const content = this.extractTextContent(message);
                if (content) {
                    metrics.assistantMessages.push(content);
                }
            }

            if (message.type === 'result' && 'total_cost_usd' in message) {
                metrics.totalCost = message.total_cost_usd;
            }

            // Fire callback if provided
            if (options.onMessage) {
                await options.onMessage(message);
            }
        }

        return { messages, metrics };
    }

    /**
     * Extract text content from an assistant message
     */
    static extractTextContent(message: SDKMessage): string {
        if (message.type !== 'assistant' || !message.message?.content) {
            return '';
        }

        return message.message.content
            .filter((c): c is TextBlock => c.type === 'text')
            .map(c => c.text)
            .join('');
    }
}