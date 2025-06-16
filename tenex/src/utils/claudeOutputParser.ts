import { EventEmitter } from "node:events";
import { logger } from "@tenex/shared";
import chalk from "chalk";

interface ClaudeMessage {
    type: string;
    subtype?: string;
    session_id?: string;
    message?: {
        id: string;
        type: string;
        role: string;
        model: string;
        content: Array<{
            type: string;
            text?: string;
            id?: string;
            name?: string;
            input?: Record<string, unknown>;
        }>;
        stop_reason?: string | null;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
        };
    };
    parent_tool_use_id?: string | null;
}

interface ToolResult {
    tool_use_id: string;
    type: string;
    content: string;
}

export class ClaudeOutputParser extends EventEmitter {
    private buffer = "";
    private sessionId: string | null = null;
    private currentToolUse: { id: string; name: string } | null = null;

    parse(chunk: string): void {
        this.buffer += chunk;

        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const data = JSON.parse(line) as ClaudeMessage;
                    this.handleMessage(data);
                } catch (_err) {
                    logger.error(chalk.red(`Failed to parse JSON: ${line}`));
                }
            }
        }
    }

    private handleMessage(data: ClaudeMessage): void {
        switch (data.type) {
            case "system":
                this.handleSystemMessage(data);
                break;
            case "assistant":
                this.handleAssistantMessage(data);
                break;
            case "user":
                this.handleUserMessage(data);
                break;
            default:
                logger.debug(chalk.gray(`Unknown message type: ${data.type}`));
        }
    }

    private handleSystemMessage(data: ClaudeMessage): void {
        if (data.subtype === "init") {
            this.sessionId = data.session_id || null;
            logger.info(chalk.blue.bold("\n📋 Claude Session Initialized"));
            logger.info(chalk.gray(`Session ID: ${this.sessionId}`));
            logger.info(chalk.gray(`Model: ${data.model || "unknown"}`));
            logger.info(chalk.gray(`Working Directory: ${data.cwd || "unknown"}`));

            if (data.mcp_servers && Array.isArray(data.mcp_servers)) {
                const connectedServers = data.mcp_servers.filter((s) => s.status === "connected");
                if (connectedServers.length > 0) {
                    logger.info(
                        chalk.green(
                            `✓ MCP Servers: ${connectedServers.map((s) => s.name).join(", ")}`
                        )
                    );
                }
            }

            this.emit("sessionInit", { sessionId: this.sessionId, data });
            logger.info("");
        }
    }

    private handleAssistantMessage(data: ClaudeMessage): void {
        if (!data.message) return;

        const content = data.message.content;

        for (const item of content) {
            if (item.type === "text" && item.text) {
                logger.info(chalk.cyan("\n🤖 Claude:"));
                logger.info(this.formatText(item.text));
            } else if (item.type === "tool_use") {
                this.currentToolUse = {
                    id: item.id || "",
                    name: item.name || "unknown",
                };
                logger.info(chalk.yellow(`\n🔧 Using tool: ${item.name}`));
                if (item.input && Object.keys(item.input).length > 0) {
                    logger.info(chalk.gray("Input:"));
                    logger.info(chalk.gray(this.formatJson(item.input)));
                }
            }
        }

        if (data.message.usage) {
            const usage = data.message.usage;
            logger.info(
                chalk.gray(`\n📊 Tokens: in=${usage.input_tokens}, out=${usage.output_tokens}`)
            );
        }
    }

    private handleUserMessage(data: ClaudeMessage): void {
        if (!data.message || data.message.role !== "user") return;

        const content = data.message.content;
        if (!Array.isArray(content)) return;

        for (const item of content) {
            if (item.type === "tool_result") {
                const result = item as unknown as ToolResult;
                logger.info(chalk.green("\n✓ Tool result:"));

                const contentLines = result.content.split("\n");
                const maxLines = 20;

                if (contentLines.length <= maxLines) {
                    logger.info(chalk.gray(result.content));
                } else {
                    logger.info(chalk.gray(contentLines.slice(0, maxLines).join("\n")));
                    logger.info(chalk.gray(`... (${contentLines.length - maxLines} more lines)`));
                }
            }
        }
    }

    private formatText(text: string): string {
        return text
            .split("\n")
            .map((line) => `  ${line}`)
            .join("\n");
    }

    private formatJson(obj: unknown): string {
        return JSON.stringify(obj, null, 2)
            .split("\n")
            .map((line) => `  ${line}`)
            .join("\n");
    }

    getSessionId(): string | null {
        return this.sessionId;
    }

    flush(): void {
        if (this.buffer.trim()) {
            try {
                const data = JSON.parse(this.buffer) as ClaudeMessage;
                this.handleMessage(data);
            } catch (_err) {
                logger.error(chalk.red(`Failed to parse remaining buffer: ${this.buffer}`));
            }
            this.buffer = "";
        }
    }
}
