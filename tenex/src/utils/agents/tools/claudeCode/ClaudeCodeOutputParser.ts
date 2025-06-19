import type { ClaudeCodeMessage } from "@/utils/agents/tools/claudeCode/types";
import type { ToolContext } from "@/utils/agents/tools/types";
import { logDebug, logError, logInfo } from "@tenex/shared/logger";
import type { NDKTask } from "@nostr-dev-kit/ndk";
import chalk from "chalk";

export class ClaudeCodeOutputParser {
    private buffer = "";
    private messageCount = 0;
    private totalCost = 0;
    private startTime = Date.now();
    private toolContext?: ToolContext;
    private taskEvent?: NDKTask;
    private sessionId?: string;

    constructor(toolContext?: ToolContext, taskEvent?: NDKTask) {
        this.toolContext = toolContext;
        this.taskEvent = taskEvent;
    }

    private async publishTaskUpdate(content: string) {
        if (!this.taskEvent || !this.toolContext?.publisher || !this.toolContext?.agent) return;

        try {
            // Create proper context for the task update
            const updateContext = {
                originalEvent: this.taskEvent, // Use the task as the original event to reply to
                projectEvent: this.toolContext.projectEvent,
                rootEventId: this.toolContext.rootEventId,
                projectId: this.toolContext.projectEvent.tagId(),
            };

            // Create AgentResponse for the task update
            const response = {
                content,
                metadata: {
                    isToolUpdate: true,
                    tool: "claude_code",
                },
            };

            // Prepare extra tags with session ID if available
            const extraTags: string[][] = [];
            if (this.sessionId) {
                extraTags.push(["claude-session-id", this.sessionId]);
            }

            // Use NostrPublisher.publishResponse which will properly create a reply using taskEvent.reply()
            await this.toolContext.publisher.publishResponse(
                response,
                updateContext,
                this.toolContext.agent.getSigner(),
                this.toolContext.agentName,
                extraTags
            );

            logDebug(chalk.gray(`Published task update: ${content.substring(0, 50)}...`));
        } catch (error) {
            logError(`Failed to publish task update: ${error}`);
        }
    }

    parseLines(data: string): ClaudeCodeMessage[] {
        const lines = (this.buffer + data).split("\n");
        const messages: ClaudeCodeMessage[] = [];

        // Keep the last incomplete line in the buffer
        this.buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line) as ClaudeCodeMessage;
                    messages.push(message);
                    
                    // Capture session ID if present
                    if (message.session_id && !this.sessionId) {
                        this.sessionId = message.session_id;
                        logDebug(chalk.gray(`Captured Claude session ID: ${this.sessionId}`));
                    }
                    
                    // Process message asynchronously without blocking
                    this.processMessage(message).catch((error) => {
                        logError(`Error processing message: ${error}`);
                    });
                } catch (_error) {
                    logError(`Failed to parse JSON line: ${line}`);
                }
            }
        }

        return messages;
    }

    private async processMessage(message: ClaudeCodeMessage) {
        switch (message.type) {
            case "system":
                // Handle system messages silently
                break;
            case "assistant":
                await this.handleAssistantMessage(message);
                break;
            case "user":
                // Skip user messages - they're just echoes of the prompt
                break;
            case "tool_use":
                await this.handleToolUse(message);
                break;
            case "result":
                this.handleResult(message);
                break;
            default:
                logDebug(chalk.gray(`[Unknown message type: ${message.type}]`));
        }
    }

    private async handleAssistantMessage(message: ClaudeCodeMessage) {
        if (message.message?.content) {
            for (const content of message.message.content) {
                if (content.type === "text" && content.text) {
                    this.messageCount++;
                    const formattedText = this.formatText(content.text);
                    logInfo(`${chalk.cyan("\n🤖 Claude:")} ${formattedText}`);

                    // Publish task update instead of typing indicator
                    await this.publishTaskUpdate(`🤖 **Claude Code**: ${content.text.trim()}`);
                }
            }

            // Show token usage if available
            if (message.message.usage) {
                const usage = message.message.usage;
                const tokens = [
                    `Input: ${usage.input_tokens}`,
                    usage.cache_read_input_tokens
                        ? `Cached: ${usage.cache_read_input_tokens}`
                        : null,
                    `Output: ${usage.output_tokens}`,
                ]
                    .filter(Boolean)
                    .join(", ");

                logDebug(chalk.gray(`   [Tokens: ${tokens}]`));
            }
        }
    }

    private async handleToolUse(message: ClaudeCodeMessage) {
        logInfo(chalk.yellow("\n🔧 Tool Use Detected"));

        // Publish task update for tool use
        if (message.tool_use) {
            const toolName = message.tool_use.name || "tool";
            await this.publishTaskUpdate(`🔧 **Tool Use**: Using ${toolName}...`);
        }
    }

    private async handleResult(message: ClaudeCodeMessage) {
        const duration = Date.now() - this.startTime;
        const seconds = (duration / 1000).toFixed(1);

        logInfo(chalk.green("\n\n✅ Task Complete"));

        if (message.result) {
            logInfo(`${chalk.white("\nSummary:")} ${this.formatText(message.result)}`);
        }

        // Show statistics
        const stats = [];
        stats.push(`Duration: ${seconds}s`);

        if (message.num_turns) {
            stats.push(`Turns: ${message.num_turns}`);
        }

        if (message.cost_usd || message.total_cost) {
            const cost = message.cost_usd || message.total_cost || 0;
            stats.push(`Cost: $${cost.toFixed(4)}`);
            this.totalCost += cost;
        }

        if (message.usage) {
            const usage = message.usage;
            const totalTokens =
                (usage.input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.output_tokens || 0);
            stats.push(`Total Tokens: ${totalTokens.toLocaleString()}`);
        }

        logDebug(chalk.gray(`\n[${stats.join(" | ")}]`));

        if (message.is_error) {
            logError(chalk.red("\n❌ Error occurred during execution"));
            await this.publishTaskUpdate("❌ **Task Failed**: Error occurred during execution");
        } else {
            // Publish completion update
            let completionMessage = "✅ **Task Complete**";
            if (message.result) {
                completionMessage += `\n\n**Summary**: ${message.result}`;
            }
            if (stats.length > 0) {
                completionMessage += `\n\n**Stats**: ${stats.join(" | ")}`;
            }
            await this.publishTaskUpdate(completionMessage);
        }
    }

    private formatText(text: string): string {
        // Trim excessive whitespace but preserve intentional formatting
        const lines = text.split("\n");
        const trimmedLines = lines.map((line) => line.trimEnd());
        const formatted = trimmedLines.join("\n").trim();

        // Add some basic formatting for common patterns
        return formatted
            .replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
                return chalk.gray(`\`\`\`${lang || ""}\n`) + chalk.white(code) + chalk.gray("```");
            })
            .replace(/`([^`]+)`/g, (_match, code) => chalk.green(`\`${code}\``))
            .replace(/\*\*([^*]+)\*\*/g, (_match, text) => chalk.bold(text));
    }

    getTotalCost(): number {
        return this.totalCost;
    }

    getMessageCount(): number {
        return this.messageCount;
    }

    getSessionId(): string | undefined {
        return this.sessionId;
    }
}
