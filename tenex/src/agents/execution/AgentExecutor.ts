import type { CompletionResponse, LLMService, Message } from "@/llm/types";
import type { ConversationPublisher } from "@/nostr";
import { PromptBuilder } from "@/prompts";
import { projectContext } from "@/services";
import {
  type TracingContext,
  type TracingLogger,
  createAgentExecutionContext,
  createTracingLogger,
} from "@/tracing";
import type { Phase } from "@/conversations/types";
import type { LLMMetadata } from "@/nostr/types";
import { inventoryExists } from "@/utils/inventory";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import type {
  AgentExecutionContext,
  AgentExecutionResult,
  AgentPromptContext,
} from "./types";
import { ReasonActLoop } from "./ReasonActLoop";

export class AgentExecutor {
  private reasonActLoop: ReasonActLoop;

  constructor(
    private llmService: LLMService,
    private conversationPublisher: ConversationPublisher,
  ) {
    this.reasonActLoop = new ReasonActLoop(llmService);
  }

  /**
   * Execute an agent's assignment for a conversation
   */
  async execute(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent,
    parentTracingContext?: TracingContext,
  ): Promise<AgentExecutionResult> {
    // Create agent execution tracing context
    const tracingContext = parentTracingContext
      ? createAgentExecutionContext(parentTracingContext, context.agent.name)
      : createAgentExecutionContext(
          {
            conversationId: context.conversation.id,
            executionId: "root",
            startTime: Date.now(),
          },
          context.agent.name,
        );

    const tracingLogger = createTracingLogger(tracingContext, "agent");

    tracingLogger.startOperation("agent_execution", {
      agentName: context.agent.name,
      agentPubkey: context.agent.pubkey,
      phase: context.phase,
    });

    try {
      // 1. Build the agent's prompt
      const promptContext = await this.buildPromptContext(context);

      // 2. Generate initial response via LLM
      const llmStartTime = Date.now();
      tracingLogger.logLLMRequest(context.agent.llmConfig || "default");

      const { response: initialResponse, userPrompt } =
        await this.generateResponse(
          promptContext,
          context.agent.llmConfig || "default",
        );

      const llmDuration = Date.now() - llmStartTime;
      tracingLogger.logLLMResponse(
        context.agent.llmConfig || "default",
        llmDuration,
        initialResponse.usage?.promptTokens,
        initialResponse.usage?.completionTokens,
      );

      // 3. Execute the Reason-Act loop
      const reasonActResult = await this.reasonActLoop.execute(
        initialResponse,
        {
          projectPath: process.cwd(),
          conversationId: context.conversation.id,
          agentName: context.agent.name,
          phase: context.phase,
          llmConfig: context.agent.llmConfig || "default",
        },
        promptContext.systemPrompt,
        userPrompt,
        tracingContext,
      );

      // 4. Build metadata with final response
      const llmMetadata = this.buildLLMMetadata(
        reasonActResult.finalResponse,
        promptContext.systemPrompt,
        userPrompt,
      );

      // 5. Determine next responder
      const nextResponder = this.determineNextResponder(
        context,
        reasonActResult.finalContent,
      );

      // 6. Publish response to Nostr
      const publishedEvent = await this.publishResponse(
        context,
        triggeringEvent,
        reasonActResult.finalContent,
        nextResponder,
        llmMetadata,
        tracingContext,
      );

      tracingLogger.completeOperation("agent_execution", {
        agentName: context.agent.name,
        responseLength: reasonActResult.finalContent.length,
        toolExecutions: reasonActResult.allToolResults.length,
        nextAgent: nextResponder,
      });

      return {
        success: true,
        response: reasonActResult.finalContent,
        llmMetadata,
        toolExecutions: reasonActResult.allToolResults,
        nextAgent: nextResponder,
        publishedEvent,
      };
    } catch (error) {
      tracingLogger.failOperation("agent_execution", error, {
        agentName: context.agent.name,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build the complete prompt context for the agent
   */
  private async buildPromptContext(
    context: AgentExecutionContext,
  ): Promise<AgentPromptContext> {
    const project = projectContext.getCurrentProject();
    const promptBuilder = new PromptBuilder();

    // Check inventory availability for chat phase
    const hasInventory =
      context.phase === "chat" ? await inventoryExists(process.cwd()) : false;

    // Build system prompt
    const systemPrompt = promptBuilder
      .add("agent-system-prompt", {
        agent: context.agent,
        phase: context.phase,
        projectTitle:
          project.tags.find((tag) => tag[0] === "title")?.[1] ||
          "Untitled Project",
        projectRepository:
          project.tags.find((tag) => tag[0] === "repo")?.[1] || "No repository",
      })
      .add("project-inventory-context", { hasInventory })
      .build();

    // Build conversation history
    const conversationHistory = new PromptBuilder()
      .add("conversation-history", {
        history: context.conversation.history,
      })
      .build();

    // Build phase context
    const phaseContext = new PromptBuilder()
      .add("phase-context", {
        phase: context.phase,
        phaseMetadata: context.conversation.metadata,
      })
      .build();

    const constraints = this.getPhaseConstraints(context.phase);

    return {
      systemPrompt,
      conversationHistory,
      phaseContext,
      availableTools: context.agent.tools,
      constraints: constraints,
    };
  }

  /**
   * Generate initial response from LLM
   */
  private async generateResponse(
    promptContext: AgentPromptContext,
    llmConfig: string,
  ): Promise<{ response: CompletionResponse; userPrompt: string }> {
    // Build full user prompt
    const userPrompt = new PromptBuilder()
      .add("full-prompt", {
        conversationContent: promptContext.conversationHistory || "",
        phaseContext: promptContext.phaseContext,
        constraints: promptContext.constraints,
        agentType: promptContext.phaseContext.includes("Phase:")
          ? "assigned expert"
          : "project assistant",
      })
      .build();

    const messages: Message[] = [
      { role: "system", content: promptContext.systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await this.llmService.complete({ messages });
    return { response, userPrompt };
  }

  /**
   * Determine who should respond next
   */
  private determineNextResponder(
    context: AgentExecutionContext,
    response: string,
  ): string | undefined {
    // Check if response indicates phase transition
    if (response.includes("PHASE_TRANSITION:")) {
      return undefined; // Router will handle
    }

    // Check if response indicates specific agent handoff
    const handoffMatch = response.match(/HANDOFF_TO:\s*(\S+)/);
    if (handoffMatch) {
      return handoffMatch[1];
    }

    // Default: continue with user
    return undefined;
  }

  /**
   * Publish the agent's response to Nostr
   */
  private async publishResponse(
    context: AgentExecutionContext,
    triggeringEvent: NDKEvent,
    content: string,
    nextResponder: string | undefined,
    llmMetadata?: LLMMetadata,
    tracingContext?: TracingContext,
  ): Promise<NDKEvent> {
    const tracingLogger = tracingContext
      ? createTracingLogger(tracingContext, "nostr")
      : logger.forModule("nostr");
    const event = await this.conversationPublisher.publishAgentResponse(
      triggeringEvent,
      content,
      nextResponder || "",
      context.agent.signer,
      llmMetadata,
    );

    if (tracingContext && "logEventPublished" in tracingLogger) {
      (tracingLogger as TracingLogger).logEventPublished(
        event.id || "unknown",
        "agent_response",
        {
          agentName: context.agent.name,
          nextResponder,
          hasLLMMetadata: !!llmMetadata,
        },
      );
    }

    return event;
  }

  /**
   * Build LLM metadata for response tracking
   */
  private buildLLMMetadata(
    response: CompletionResponse,
    systemPrompt: string,
    userPrompt: string,
  ): LLMMetadata | undefined {
    if (!response.usage) {
      return undefined;
    }

    return {
      model: response.model || "unknown",
      cost: 0,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
    };
  }

  /**
   * Get phase-specific constraints
   */
  private getPhaseConstraints(phase: Phase): string[] {
    switch (phase) {
      case "chat":
        return [
          "Focus on understanding requirements",
          "Ask one or two clarifying questions at most",
          "Keep responses concise and friendly",
        ];

      case "plan":
        return [
          "Create a structured plan with clear milestones",
          "Include time estimates when possible",
          "Identify potential risks or challenges",
        ];

      case "execute":
        return [
          "Focus on implementation details",
          "Provide code examples when relevant",
          "Explain technical decisions",
        ];

      case "review":
        return [
          "Provide constructive feedback",
          "Highlight both strengths and areas for improvement",
          "Suggest specific improvements",
        ];

      default:
        return [];
    }
  }
}
