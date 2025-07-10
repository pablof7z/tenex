import type { Tool } from "@/tools/types";
import type { ExecutionBackend } from "./ExecutionBackend";
import type { AgentExecutionContext } from "./types";
import { handleAgentCompletion } from "./completionHandler";
import { ClaudeTaskOrchestrator } from "@/claude/orchestrator";
import { TaskPublisher } from "@/nostr/TaskPublisher";
import { getNDK } from "@/nostr/ndkClient";
import type { NostrPublisher } from "@/nostr/NostrPublisher";

/**
 * ClaudeBackend executes tasks by directly calling Claude Code
 * and then uses the same completion logic as the complete() tool to return
 * control to the orchestrator.
 */
export class ClaudeBackend implements ExecutionBackend {
  async execute(
    messages: Array<import("multi-llm-ts").Message>,
    tools: Tool[],
    context: AgentExecutionContext,
    publisher: NostrPublisher
  ): Promise<void> {
    // Extract the system prompt from messages
    const systemMessage = messages.find(m => m.role === "system");
    const systemPrompt = systemMessage?.content;
    
    // Extract the prompt from the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      throw new Error("No messages provided");
    }
    const prompt = lastMessage.content || "";

    if (!prompt) {
      throw new Error("No prompt found in messages");
    }

    // Create instances for direct Claude Code execution
    const ndk = getNDK();
    const taskPublisher = new TaskPublisher(ndk, context.agent);
    const orchestrator = new ClaudeTaskOrchestrator(taskPublisher);

    // Execute Claude Code directly
    const result = await orchestrator.execute({
      prompt,
      systemPrompt,
      projectPath: context.projectPath || "",
      title: `Claude Code Execution (via ${context.agent.name})`,
      conversationRootEventId: context.conversation.id,
      conversation: context.conversation,
      abortSignal: undefined, // Could be passed from context if available
    });

    if (!result.success) {
      throw new Error(`Claude code execution failed: ${result.error || "Unknown error"}`);
    }

    // Extract the comprehensive report from the last assistant message
    const claudeReport = result.task.content || "Task completed successfully";

    // Use the same completion handler as the complete() tool
    // This will publish the completion event
    await handleAgentCompletion({
      response: claudeReport,
      summary: `Claude Code execution completed. Task ID: ${result.task.id}`,
      agent: context.agent,
      conversationId: context.conversation.id,
      publisher,
    });
  }
}