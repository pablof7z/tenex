import type { CompletionResponse, LLMService, Message } from "@/llm/types";
import type { ConversationPublisher, TypingIndicatorPublisher } from "@/nostr";
import { PromptBuilder } from "@/prompts";
import { getProjectContext } from "@/services";
import {
    type TracingContext,
    type TracingLogger,
    createTracingContext,
    createAgentExecutionContext,
    createTracingLogger,
} from "@/tracing";
import type { Phase } from "@/conversations/types";
import type { LLMMetadata } from "@/nostr/types";
import { inventoryExists } from "@/utils/inventory";
import type { NDKEvent, NDKTag } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import type { AgentExecutionContext, AgentExecutionResult, AgentPromptContext } from "./types";
import { ReasonActLoop } from "./ReasonActLoop";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import type { ToolExecutionResult } from "@/tools/types";
import { getDefaultToolsForAgent } from "@/agents/constants";

export class AgentExecutor {
    private reasonActLoop: ReasonActLoop;

    constructor(
        private llmService: LLMService,
        private conversationPublisher: ConversationPublisher,
        private typingIndicatorPublisher?: TypingIndicatorPublisher
    ) {
        this.reasonActLoop = new ReasonActLoop(llmService);
    }

    /**
     * Execute an agent's assignment for a conversation
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
            agentName: context.agent.name,
            agentPubkey: context.agent.pubkey,
            phase: context.phase,
        });

        try {
            // 1. Get phase-aware tools for this agent
            const phaseAwareTools = context.agent.isBoss 
                ? getDefaultToolsForAgent(true, context.phase)
                : context.agent.tools || getDefaultToolsForAgent(false);

            // Create a modified agent with phase-aware tools
            const agentWithPhaseTools = {
                ...context.agent,
                tools: phaseAwareTools
            };

            // 2. Build the agent's prompt with phase-aware agent
            const promptContext = await this.buildPromptContext({
                ...context,
                agent: agentWithPhaseTools
            });

            // 3. Publish typing indicator start
            if (this.typingIndicatorPublisher) {
                await this.typingIndicatorPublisher.publishTypingStart(
                    triggeringEvent,
                    context.agent.signer
                );
            }

            // 4. Generate initial response via LLM
            tracingLogger.logLLMRequest(context.agent.llmConfig || DEFAULT_AGENT_LLM_CONFIG);

            const { response: initialResponse, userPrompt } = await this.generateResponse(
                promptContext,
                context.agent.llmConfig || DEFAULT_AGENT_LLM_CONFIG
            );

            tracingLogger.logLLMResponse(context.agent.llmConfig || DEFAULT_AGENT_LLM_CONFIG);

            // 5. Execute the Reason-Act loop with phase-aware agent
            const reasonActResult = await this.reasonActLoop.execute(
                initialResponse,
                {
                    projectPath: process.cwd(),
                    conversationId: context.conversation.id,
                    agentName: context.agent.name,
                    phase: context.phase,
                    llmConfig: context.agent.llmConfig || DEFAULT_AGENT_LLM_CONFIG,
                    agent: agentWithPhaseTools, // Pass agent with phase-aware tools
                    conversation: context.conversation, // Pass the full conversation object
                },
                promptContext.systemPrompt,
                userPrompt,
                tracingContext
            );

            // 5. Build metadata with final response
            const llmMetadata = this.buildLLMMetadata(
                reasonActResult.finalResponse,
                promptContext.systemPrompt,
                userPrompt
            );

            // 6. Currently, agents don't hand off to other agents
            const nextResponder = undefined;

            // 7. Check for phase transition in tool results
            const phaseTransition = this.extractPhaseTransition(reasonActResult.allToolResults);
            
            // 8. Publish response to Nostr
            const publishedEvent = await this.publishResponse(
                context,
                triggeringEvent,
                reasonActResult.finalContent,
                nextResponder,
                llmMetadata,
                tracingContext,
                phaseTransition
            );

            // Log the agent response in human-readable format
            logger.agentResponse(
                context.agent.name,
                reasonActResult.finalContent,
                context.conversation.id,
                context.conversation.title,
                publishedEvent.id
            );

            // 9. Publish typing indicator stop
            if (this.typingIndicatorPublisher) {
                await this.typingIndicatorPublisher.publishTypingStop(
                    triggeringEvent,
                    context.agent.signer
                );
            }

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
            // Ensure typing indicator is stopped even on error
            if (this.typingIndicatorPublisher) {
                await this.typingIndicatorPublisher.publishTypingStop(
                    triggeringEvent,
                    context.agent.signer
                );
            }

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
    private async buildPromptContext(context: AgentExecutionContext): Promise<AgentPromptContext> {
        const projectCtx = getProjectContext();
        const project = projectCtx.project;
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
                    project.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled Project",
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
        llmConfig: string
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

        const response = await this.llmService.complete({ 
            messages,
            options: { model: llmConfig }
        });
        return { response, userPrompt };
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
        phaseTransition?: string
    ): Promise<NDKEvent> {
        const tracingLogger = tracingContext
            ? createTracingLogger(tracingContext, "nostr")
            : logger.forModule("nostr");
        
        // Check if this is a phase transition request
        const additionalTags: NDKTag[] = [];
        if (phaseTransition) {
            additionalTags.push(["phase", phaseTransition]);
        }
        
        const event = await this.conversationPublisher.publishAgentResponse(
            triggeringEvent,
            content,
            nextResponder || "",
            context.agent.signer,
            llmMetadata,
            additionalTags
        );

        if (tracingContext && "logEventPublished" in tracingLogger) {
            tracingLogger.logEventPublished(
                event.id || "unknown",
                "agent_response",
                {
                    agentName: context.agent.name,
                    nextResponder,
                    hasLLMMetadata: !!llmMetadata,
                }
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
        userPrompt: string
    ): LLMMetadata | undefined {
        if (!response.usage) {
            return undefined;
        }

        // Calculate cost based on model and token usage
        const cost = this.calculateCost(
            response.model || "unknown",
            response.usage.promptTokens,
            response.usage.completionTokens
        );

        return {
            model: response.model || "unknown",
            cost,
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            totalTokens: response.usage.totalTokens,
            systemPrompt,
            userPrompt,
            rawResponse: response.content,
        };
    }

    /**
     * Calculate cost based on model and token usage
     */
    private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
        // Cost per 1M tokens (rough estimates, should be updated with actual pricing)
        const costPerMillion: Record<string, { prompt: number; completion: number }> = {
            "gpt-4": { prompt: 30, completion: 60 },
            "gpt-4-turbo": { prompt: 10, completion: 30 },
            "gpt-3.5-turbo": { prompt: 0.5, completion: 1.5 },
            "claude-3-opus": { prompt: 15, completion: 75 },
            "claude-3-sonnet": { prompt: 3, completion: 15 },
            "claude-3-haiku": { prompt: 0.25, completion: 1.25 },
            "gemini-2.5-flash": { prompt: 0.075, completion: 0.3 },
            "gemini-1.5-pro": { prompt: 3.5, completion: 10.5 },
            "gemini-1.5-flash": { prompt: 0.35, completion: 1.05 },
            "mistral-large": { prompt: 8, completion: 24 },
            "mixtral-8x7b": { prompt: 0.7, completion: 0.7 },
        };

        // Find the model in our pricing table
        const modelLower = model.toLowerCase();
        let pricing = { prompt: 1, completion: 1 }; // Default pricing if model not found

        for (const [key, value] of Object.entries(costPerMillion)) {
            if (modelLower.includes(key)) {
                pricing = value;
                break;
            }
        }

        // Calculate cost in USD
        const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
        const completionCost = (completionTokens / 1_000_000) * pricing.completion;

        return promptCost + completionCost;
    }

    /**
     * Extract phase transition from tool results
     */
    private extractPhaseTransition(toolResults: ToolExecutionResult[]): string | undefined {
        for (const result of toolResults) {
            if (result.toolName === "phase_transition" && result.success && result.metadata?.requestedPhase) {
                return result.metadata.requestedPhase as string;
            }
        }
        return undefined;
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
