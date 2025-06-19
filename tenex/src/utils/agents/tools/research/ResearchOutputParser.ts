import type { ClaudeCodeMessage } from "@/utils/agents/tools/claudeCode/types";
import type { ToolContext } from "@/utils/agents/tools/types";
import { logDebug, logError, logInfo } from "@tenex/shared/logger";
import type { NDKTask } from "@nostr-dev-kit/ndk";
import chalk from "chalk";

export class ResearchOutputParser {
    private buffer = "";
    private sessionId?: string;
    private toolContext?: ToolContext;
    private taskEvent?: NDKTask;
    private messageCount = 0;
    private totalCost = 0;

    constructor(toolContext?: ToolContext, taskEvent?: NDKTask) {
        this.toolContext = toolContext;
        this.taskEvent = taskEvent;
    }

    private async publishTaskUpdate(content: string) {
        if (!this.taskEvent || !this.toolContext?.publisher || !this.toolContext?.agent) return;

        try {
            // Create proper context for the task update
            const updateContext = {
                originalEvent: this.taskEvent,
                projectEvent: this.toolContext.projectEvent,
                rootEventId: this.toolContext.rootEventId,
                projectId: this.toolContext.projectEvent.tagId(),
            };

            // Create AgentResponse for the task update
            const response = {
                content,
                metadata: {
                    isToolUpdate: true,
                    tool: "research",
                },
            };

            // Prepare extra tags with session ID if available
            const extraTags: string[][] = [];
            if (this.sessionId) {
                extraTags.push(["claude-session-id", this.sessionId]);
            }

            // Use NostrPublisher.publishResponse
            await this.toolContext.publisher.publishResponse(
                response,
                updateContext,
                this.toolContext.agent.getSigner(),
                this.toolContext.agentName,
                extraTags
            );

            logDebug(chalk.gray(`Published research update: ${content.substring(0, 50)}...`));
        } catch (error) {
            logError(`Failed to publish research update: ${error}`);
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

                    // Update costs if available
                    if (message.cost_usd || message.total_cost) {
                        const cost = message.cost_usd || message.total_cost || 0;
                        this.totalCost += cost;
                    }

                    // Count messages
                    if (message.type === "assistant") {
                        this.messageCount++;
                    }
                    
                    // Process message asynchronously without blocking
                    this.processMessage(message).catch((error) => {
                        logError(`Error processing message: ${error}`);
                    });
                } catch (_error) {
                    // Not JSON, ignore
                }
            }
        }

        return messages;
    }

    private async processMessage(message: ClaudeCodeMessage) {
        switch (message.type) {
            case "assistant":
                if (message.message?.content) {
                    for (const content of message.message.content) {
                        if (content.type === "text" && content.text) {
                            await this.publishTaskUpdate(`🔍 **Research Progress**: ${content.text.substring(0, 200)}...`);
                        }
                    }
                }
                break;
            case "result":
                if (message.is_error) {
                    await this.publishTaskUpdate("❌ **Research Failed**: Error occurred during research");
                } else {
                    await this.publishTaskUpdate("✅ **Research Complete**: Report generated successfully");
                }
                break;
        }
    }

    getSessionId(): string | undefined {
        return this.sessionId;
    }

    getTotalCost(): number {
        return this.totalCost;
    }

    getMessageCount(): number {
        return this.messageCount;
    }
}