import { spawn } from "node:child_process";
import { getNDK } from "@/nostr";
import { ClaudeParser } from "@/utils/claude/ClaudeParser";
import type NDK from "@nostr-dev-kit/ndk";
import { type NDKEvent, type NDKPrivateKeySigner, type NDKSigner, NDKTask } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";

export interface ClaudeCodeExecutorOptions {
  conversationId: string;
  signer: NDKSigner;
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

export interface ClaudeCodeRequest {
  prompt: string;
  conversationContext: string;
  requirements: string;
  phase: string;
}

export class ClaudeCodeExecutor {
  private parser: ClaudeParser;
  private taskEvent?: NDKTask;
  private sessionId?: string;
  private messageBuffer: string[] = [];
  private ndk: NDK;
  private signer: NDKPrivateKeySigner;
  private conversationId: string;

  constructor(options: ClaudeCodeExecutorOptions) {
    this.parser = new ClaudeParser();
    this.conversationId = options.conversationId;
    this.signer = options.signer as NDKPrivateKeySigner;
    this.ndk = getNDK();
  }

  /**
   * Execute a Claude Code task with the given request
   */
  async execute(request: ClaudeCodeRequest): Promise<string> {
    // Create a simple task ID
    const taskId = `claude-task-${Date.now()}`;
    
    // For now, we'll just return the task ID
    // In a real implementation, this would spawn Claude Code and track the task
    logger.info("Starting Claude Code task", { 
      taskId, 
      phase: request.phase,
      conversationId: this.conversationId 
    });
    
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