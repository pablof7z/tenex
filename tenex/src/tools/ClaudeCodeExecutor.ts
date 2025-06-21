import { spawn } from "node:child_process";
import { getNDK } from "@/nostr";
import type { ProjectContext } from "@/runtime";
import { ClaudeParser } from "@/utils/claude/ClaudeParser";
import type NDK from "@nostr-dev-kit/ndk";
import { type NDKEvent, type NDKPrivateKeySigner, type NDKSigner, NDKTask } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";

export interface ClaudeCodeExecutorOptions {
  prompt: string;
  projectPath?: string;
  ndk: NDK;
  projectContext: ProjectContext;
  conversationRootEvent: NDKEvent;
  signer: NDKPrivateKeySigner;
  title?: string;
  phase?: "plan" | "execute";
}

export interface ClaudeCodeResult {
  success: boolean;
  output?: string;
  error?: string;
  sessionId?: string;
  taskEvent?: NDKTask;
  totalCost?: number;
  messageCount?: number;
}

export class ClaudeCodeExecutor {
  private parser: ClaudeParser;
  private taskEvent?: NDKTask;
  private sessionId?: string;
  private messageBuffer: string[] = [];
  private ndk: NDK;
  private signer: NDKPrivateKeySigner;
  private conversationId: string;

  constructor(options: { conversationId: string; signer: NDKSigner }) {
    this.parser = new ClaudeParser();
    this.conversationId = options.conversationId;
    this.signer = options.signer as NDKPrivateKeySigner;
    this.ndk = getNDK();
  }

  async execute(): Promise<ClaudeCodeResult> {
    try {
      // Create NDKTask for this Claude Code execution
      await this.createTask();

      // Spawn Claude Code process
      const result = await this.spawnClaudeCode();

      return result;
    } catch (error) {
      logger.error("Claude Code execution failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async createTask(): Promise<void> {
    try {
      const ndk = await getNDK();
      this.taskEvent = new NDKTask(ndk);
      this.taskEvent.title = this.options.title || "Claude Code Task";
      this.taskEvent.content = this.options.prompt;

      // Tag the task with the project
      this.taskEvent.tag(this.options.projectContext.projectEvent);

      // E-tag the conversation root
      this.taskEvent.tags.push(["e", this.options.conversationRootEvent.id]);

      // Add phase-specific tags
      this.taskEvent.tags.push(["tool", "claude_code"]);
      if (this.options.phase) {
        this.taskEvent.tags.push(["phase", this.options.phase]);
      }

      // Sign and publish
      await this.taskEvent.sign(this.options.signer);
      await this.taskEvent.publish();

      logger.info("Created NDKTask for Claude Code", {
        taskId: this.taskEvent.id,
        title: this.taskEvent.title,
      });
    } catch (error) {
      logger.error("Failed to create NDKTask", { error });
      // Continue without task if creation fails
    }
  }

  private spawnClaudeCode(): Promise<ClaudeCodeResult> {
    return new Promise((resolve, reject) => {
      const args = ["code", "--output-format", "stream-json", "--verbose", this.options.prompt];

      logger.info("Spawning Claude Code", {
        command: "claude",
        args,
        cwd: this.options.projectPath || process.cwd(),
        projectPath: this.options.projectPath,
        hasTaskEvent: !!this.taskEvent,
        taskId: this.taskEvent?.id,
      });

      const claudeProcess = spawn("claude", args, {
        cwd: this.options.projectPath || process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        shell: true, // Use shell to handle aliases
      });

      let finalResult = "";
      let hasError = false;

      // Handle stdout
      claudeProcess.stdout?.on("data", async (chunk: Buffer) => {
        const data = chunk.toString();

        try {
          const messages = this.parser.parseLines(data);

          for (const message of messages) {
            await this.handleClaudeMessage(message);

            // Capture session ID
            if (message.session_id && !this.sessionId) {
              this.sessionId = message.session_id;
              logger.debug("Claude Code session started", { sessionId: this.sessionId });
            }

            // Capture final result
            if (message.type === "result") {
              if (message.result) {
                finalResult = message.result;
              }
              if (message.is_error) {
                hasError = true;
              }
            }
          }
        } catch (error) {
          logger.error("Error parsing Claude Code output", { error, data });
        }
      });

      // Handle stderr
      claudeProcess.stderr?.on("data", (chunk: Buffer) => {
        const error = chunk.toString();
        logger.error("Claude Code stderr", { error });
      });

      // Handle process completion
      claudeProcess.on("close", (code) => {
        logger.info("Claude Code process completed", {
          code,
          hasError,
          sessionId: this.sessionId,
          messageCount: this.parser.getMessageCount(),
          totalCost: this.parser.getTotalCost(),
        });

        if (code !== 0 || hasError) {
          reject(new Error(`Claude Code exited with code ${code}`));
        } else {
          resolve({
            success: true,
            output: finalResult || "Task completed successfully",
            sessionId: this.sessionId,
            taskEvent: this.taskEvent,
            totalCost: this.parser.getTotalCost(),
            messageCount: this.parser.getMessageCount(),
          });
        }
      });

      // Handle spawn errors
      claudeProcess.on("error", (error) => {
        logger.error("Failed to spawn Claude Code", {
          error: error.message,
          command: "claude",
          args,
          cwd: this.options.projectPath || process.cwd(),
          PATH: process.env.PATH,
        });
        reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
      });
    });
  }

  private async handleClaudeMessage(message: any): Promise<void> {
    // Process different message types and publish updates
    switch (message.type) {
      case "assistant":
        await this.publishAssistantMessage(message);
        break;
      case "tool_use":
        await this.publishToolUse(message);
        break;
      case "result":
        await this.publishResult(message);
        break;
      default:
        // Log other message types for debugging
        logger.debug("Claude Code message", { type: message.type, message });
    }
  }

  private async publishAssistantMessage(message: any): Promise<void> {
    if (!this.taskEvent || !message.message?.content) return;

    for (const content of message.message.content) {
      if (content.type === "text" && content.text) {
        const reply = this.taskEvent.reply();
        reply.content = `🤖 **Claude Code**: ${content.text}`;

        // Add metadata tags
        if (this.sessionId) {
          reply.tags.push(["claude-session-id", this.sessionId]);
        }
        reply.tags.push(["claude-message-type", "assistant"]);

        await reply.sign(this.options.signer);
        await reply.publish();

        logger.debug("Published assistant message", { id: reply.id });
      }
    }
  }

  private async publishToolUse(message: any): Promise<void> {
    if (!this.taskEvent) return;

    const toolName = message.tool_use?.name || "unknown";

    const reply = this.taskEvent.reply();
    reply.content = `🔧 **Tool Use**: Using ${toolName}...`;

    // Add metadata tags
    if (this.sessionId) {
      reply.tags.push(["claude-session-id", this.sessionId]);
    }
    reply.tags.push(["claude-message-type", "tool_use"]);
    reply.tags.push(["tool-name", toolName]);

    await reply.sign(this.options.signer);
    await reply.publish();

    logger.debug("Published tool use", { id: reply.id, toolName });
  }

  private async publishResult(message: any): Promise<void> {
    if (!this.taskEvent) return;

    let content = "✅ **Task Complete**";

    if (message.result) {
      content += `\n\n**Summary**: ${message.result}`;
    }

    // Add statistics
    const stats = [];
    if (message.duration) {
      stats.push(`Duration: ${(message.duration / 1000).toFixed(1)}s`);
    }
    if (message.num_turns) {
      stats.push(`Turns: ${message.num_turns}`);
    }
    if (message.cost_usd || message.total_cost) {
      const cost = message.cost_usd || message.total_cost || 0;
      stats.push(`Cost: $${cost.toFixed(4)}`);
    }
    if (message.usage) {
      const totalTokens =
        (message.usage.input_tokens || 0) +
        (message.usage.output_tokens || 0) +
        (message.usage.cache_read_input_tokens || 0);
      stats.push(`Tokens: ${totalTokens.toLocaleString()}`);
    }

    if (stats.length > 0) {
      content += `\n\n**Stats**: ${stats.join(" | ")}`;
    }

    if (message.is_error) {
      content = `❌ **Task Failed**: ${message.error || "Unknown error"}`;
    }

    const reply = this.taskEvent.reply();
    reply.content = content;

    // Add metadata tags
    if (this.sessionId) {
      reply.tags.push(["claude-session-id", this.sessionId]);
    }
    reply.tags.push(["claude-message-type", "result"]);
    reply.tags.push(["is-error", message.is_error ? "true" : "false"]);

    await reply.sign(this.options.signer);
    await reply.publish();

    logger.info("Published result", {
      id: reply.id,
      isError: message.is_error,
      cost: message.cost_usd || message.total_cost,
    });
  }

  /**
   * Execute a Claude Code task with the given request
   */
  async execute(request: {
    prompt: string;
    conversationContext: string;
    requirements: string;
    phase: string;
  }): Promise<string> {
    // Create a simple task ID
    const taskId = `claude-task-${Date.now()}`;
    
    // For now, we'll use the existing execute method logic
    // In a real implementation, this would spawn Claude Code and track the task
    logger.info("Starting Claude Code task", { taskId, phase: request.phase });
    
    // Return the task ID for tracking
    return taskId;
  }

  /**
   * Get the result of a Claude Code task
   */
  async getTaskResult(taskId: string): Promise<string | null> {
    try {
      // Query Nostr for task completion events
      const filter = {
        kinds: [1], // Text notes
        "#claude-message-type": ["result"],
        "#e": [this.conversationId],
        since: Math.floor(Date.now() / 1000) - 300, // Last 5 minutes
      };

      const events = await this.ndk.fetchEvents(filter);
      
      // Look for the most recent result
      const resultEvents = Array.from(events).sort((a, b) => 
        (b.created_at || 0) - (a.created_at || 0)
      );

      if (resultEvents.length > 0) {
        const latestResult = resultEvents[0];
        
        // Extract JSON from the content if present
        const content = latestResult.content;
        const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
        
        if (jsonMatch) {
          return jsonMatch[1];
        }
        
        // Return the full content if no JSON block found
        return content;
      }

      return null;
    } catch (error) {
      logger.error("Failed to get task result", { error, taskId });
      return null;
    }
  }
}
