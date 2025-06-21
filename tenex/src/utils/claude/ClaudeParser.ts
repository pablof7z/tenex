import { logDebug, logError } from "@tenex/shared/logger";
import chalk from "chalk";

// Claude Code message types
export interface ClaudeCodeMessage {
  type: string;
  content?: string;
  conversationId?: string;
  sessionId?: string;
  cost?: number;
  messageId?: string;
  role?: string;
  model?: string;
  [key: string]: unknown;
}

export type MessageHandler = (message: ClaudeCodeMessage) => void | Promise<void>;

export class ClaudeParser {
  private buffer = "";
  private sessionId?: string;
  private messageCount = 0;
  private totalCost = 0;
  private startTime = Date.now();
  private onMessage?: MessageHandler;

  constructor(onMessage?: MessageHandler) {
    this.onMessage = onMessage;
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

          // Track state
          this.trackMessage(message);

          // Fire callback if provided
          if (this.onMessage) {
            Promise.resolve(this.onMessage(message)).catch((error) => {
              logError(`Error in message handler: ${error}`);
            });
          }
        } catch {
          logError(`Failed to parse JSON line: ${line}`);
        }
      }
    }

    return messages;
  }

  private trackMessage(message: ClaudeCodeMessage): void {
    // Capture session ID
    if (message.session_id && !this.sessionId) {
      this.sessionId = message.session_id;
      logDebug(chalk.gray(`Captured Claude session ID: ${this.sessionId}`));
    }

    // Track costs
    if (message.cost_usd || message.total_cost) {
      const cost = message.cost_usd || message.total_cost || 0;
      this.totalCost += cost;
    }

    // Count assistant messages
    if (message.type === "assistant") {
      this.messageCount++;
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

  getDuration(): number {
    return Date.now() - this.startTime;
  }
}
