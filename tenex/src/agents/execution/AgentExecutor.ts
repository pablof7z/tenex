import type { ConversationManager } from "@/conversations/ConversationManager";
import type { LLMService } from "@/llm/types";
import { NostrPublisher } from "@/nostr";
import { buildSystemPrompt } from "@/prompts/utils/systemPromptBuilder";
import { getProjectContext } from "@/services";
import { mcpService } from "@/services/mcp/MCPService";
import {
  type TracingContext,
  createAgentExecutionContext,
  createTracingContext,
  createTracingLogger,
} from "@/tracing";
import { logger } from "@/utils/logger";
import type NDK from "@nostr-dev-kit/ndk";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { Message } from "multi-llm-ts";
import { ReasonActLoop } from "./ReasonActLoop";
import { ClaudeBackend } from "./ClaudeBackend";
import type { ExecutionBackend } from "./ExecutionBackend";
import type {
  AgentExecutionContext,
  AgentExecutionContextWithHandoff,
  AgentExecutionResult,
} from "./types";
import "@/prompts/fragments/available-agents";
import "@/prompts/fragments/orchestrator-routing";
import "@/prompts/fragments/expertise-boundaries";
import { startExecutionTime, stopExecutionTime } from "@/conversations/executionTime";

export class AgentExecutor {
  constructor(
    private llmService: LLMService,
    private ndk: NDK,
    private conversationManager: ConversationManager
  ) {}

  /**
   * Get the appropriate execution backend based on agent configuration
   */
  private getBackend(agent: import("@/agents/types").Agent): ExecutionBackend {
    const backendType = agent.backend || 'reason-act-loop';
    
    switch (backendType) {
      case 'claude':
        return new ClaudeBackend();
      case 'reason-act-loop':
      default:
        return new ReasonActLoop(this.llmService, this.conversationManager);
    }
  }

  /**
   * Execute an agent's assignment for a conversation with streaming
   */
  async execute(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent,
    parentTracingContext?: TracingContext
  ): Promise<AgentExecutionResult> {
    // Create agent execution tracing context
    const tracingContext = parentTracingContext
      ? createAgentExecutionContext(parentTracingContext, context.agent.name)
      : createAgentExecutionContext(
          createTracingContext(context.conversation.id),
          context.agent.name
        );

    const tracingLogger = createTracingLogger(tracingContext, "agent");

    tracingLogger.startOperation("agent_execution", {
      phase: context.phase,
    });

    // Create NostrPublisher for ReasonActLoop to handle publishing
    const publisher = new NostrPublisher({
      conversation: context.conversation,
      agent: context.agent,
      triggeringEvent: triggeringEvent,
      conversationManager: this.conversationManager,
    });

    try {
      // Start execution time tracking
      startExecutionTime(context.conversation);

      // 1. Build the agent's messages
      const messages = await this.buildMessages(context, triggeringEvent);

      // 2. Publish typing indicator start
      await publisher.publishTypingIndicator("start");

      // Ensure context has all required fields
      const fullContext: AgentExecutionContext = {
        ...context,
        projectPath: context.projectPath || process.cwd(),
        eventToReply: triggeringEvent,
      };

      await this.executeWithStreaming(
        fullContext,
        messages,
        tracingContext,
        publisher
      );

      // Conversation updates are now handled by NostrPublisher

      return {
        success: true,
        response: "Task completed successfully",
        toolExecutions: [],
      };
    } catch (error) {
      // Stop execution time tracking even on error
      stopExecutionTime(context.conversation);

      // Conversation saving is now handled by NostrPublisher

      // Ensure typing indicator is stopped even on error
      await publisher.publishTypingIndicator("stop");

      tracingLogger.failOperation("agent_execution", error, {
        agentName: context.agent.name,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Build the messages array for the agent execution
   */
  private async buildMessages(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent
  ): Promise<Message[]> {
    const projectCtx = getProjectContext();
    const project = projectCtx.project;

    // Create tag map for efficient lookup
    const tagMap = new Map<string, string>();
    for (const tag of project.tags) {
      if (tag.length >= 2 && tag[0] && tag[1]) {
        tagMap.set(tag[0], tag[1]);
      }
    }

    // No need to load inventory or context files here anymore
    // The fragment handles this internally

    // Get all available agents for handoffs
    const availableAgents = Array.from(projectCtx.agents.values());

    const messages: Message[] = [];

    // Get MCP tools for the prompt
    const mcpTools = await mcpService.getAvailableTools();

    // Build system prompt using the shared function
    const systemPrompt = buildSystemPrompt({
      agent: context.agent,
      phase: context.phase,
      projectTitle: tagMap.get("title") || "Untitled Project",
      projectRepository: tagMap.get("repo"),
      availableAgents,
      conversation: context.conversation,
      agentLessons: projectCtx.agentLessons,
      mcpTools,
      claudeCodeReport: context.additionalContext?.claudeCodeReport,
    });

    messages.push(new Message("system", systemPrompt));

    // Use agent's isolated context instead of full history
    let agentContext = this.conversationManager.getAgentContext(
      context.conversation.id,
      context.agent.slug
    );

    // If no context exists, this agent is being invoked for the first time
    if (!agentContext) {
        // Check if this is a handoff from another agent (will be set in execute method)
        const handoff = (context as AgentExecutionContextWithHandoff).handoff;

        if (handoff) {
          logger.info("[AGENT_EXECUTOR] Creating context from handoff", {
            fromAgent: handoff.agentName,
            toAgent: context.agent.slug,
            handoffMessage: `${handoff.message.substring(0, 100)}...`,
          });

          // Create context with handoff information
          agentContext = this.conversationManager.createAgentContext(
            context.conversation.id,
            context.agent.slug,
            handoff
          );
        } else {
          logger.info("[AGENT_EXECUTOR] Bootstrapping context for direct invocation", {
            agentSlug: context.agent.slug,
          });

          // Bootstrap context for direct invocation (e.g., p-tag mention)
          agentContext = await this.conversationManager.bootstrapAgentContext(
            context.conversation.id,
            context.agent.slug,
            triggeringEvent
          );
        }
      } else {
        // Context exists - synchronize with missed messages
        logger.info("[AGENT_EXECUTOR] Synchronizing existing context", {
          agentSlug: context.agent.slug,
          currentMessages: agentContext.messages.length,
        });

        await this.conversationManager.synchronizeAgentContext(
          context.conversation.id,
          context.agent.slug,
          triggeringEvent
        );
      }

    // Add the agent's isolated messages
    messages.push(...agentContext.messages);

    logger.info("[AGENT_EXECUTOR] Final message state for agent", {
      agentSlug: context.agent.slug,
      totalMessages: messages.length,
      messages: messages.map((m) => ({
        role: m.role,
        contentPreview: `${m.content.substring(0, 100)}...`,
      })),
    });

    return messages;
  }


  /**
   * Execute with streaming support
   */
  private async executeWithStreaming(
    context: AgentExecutionContext,
    messages: Message[],
    tracingContext: TracingContext,
    publisher: NostrPublisher
  ): Promise<void> {
    const tracingLogger = createTracingLogger(tracingContext, "agent");

    // Get tools for response processing - use agent's configured tools
    const tools = context.agent.tools || [];

    // Add MCP tools if available and agent has MCP access
    let allTools = tools;
    if (context.agent.mcp !== false) {
      const mcpTools = await mcpService.getAvailableTools();
      allTools = [...tools, ...mcpTools];
    }

    // Get the appropriate backend for this agent
    const backend = this.getBackend(context.agent);

    // Execute using the backend - all backends now use the same interface
    await backend.execute(messages, allTools, context, publisher);

    tracingLogger.info("[AGENT_EXECUTOR] Backend execution completed", {
      agent: context.agent.name,
      backend: context.agent.backend || 'reason-act-loop',
    });
  }
}
