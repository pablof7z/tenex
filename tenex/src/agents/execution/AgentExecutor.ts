import type { CompletionResponse, LLMService, Message } from "@/llm/types";
import { publishAgentResponse, publishTypingStart, publishTypingStop } from "@/nostr";
import type NDK from "@nostr-dev-kit/ndk";
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
import type { AgentExecutionContext, AgentExecutionResult } from "./types";
import { ReasonActLoop } from "./ReasonActLoop";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import type { ToolExecutionResult } from "@/tools/types";
import { getDefaultToolsForAgent } from "@/agents/constants";
import type { ConversationManager } from "@/conversations/ConversationManager";
import { openRouterPricing } from "@/llm/pricing";
import "@/prompts/fragments/available-agents";
import "@/prompts/fragments/pm-routing";

export class AgentExecutor {
    private reasonActLoop: ReasonActLoop;

    constructor(
        private llmService: LLMService,
        private ndk: NDK,
        private conversationManager?: ConversationManager
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
            const phaseAwareTools = context.agent.isPMAgent
                ? getDefaultToolsForAgent(true, context.phase)
                : context.agent.tools || getDefaultToolsForAgent(false);

            // Create a modified agent with phase-aware tools
            const agentWithPhaseTools = {
                ...context.agent,
                tools: phaseAwareTools,
            };

            // 2. Build the agent's prompts
            const { systemPrompt, userPrompt } = await this.buildPrompts({
                ...context,
                agent: agentWithPhaseTools,
            });

            // 3. Publish typing indicator start
            await publishTypingStart(
                this.ndk,
                triggeringEvent,
                context.agent.signer
            );

            // 4. Generate initial response via LLM
            tracingLogger.logLLMRequest(context.agent.llmConfig || DEFAULT_AGENT_LLM_CONFIG);

            const initialResponse = await this.generateResponse(
                systemPrompt,
                userPrompt,
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
                systemPrompt,
                userPrompt,
                tracingContext
            );

            // 5. Build metadata with final response
            const llmMetadata = await this.buildLLMMetadata(
                reasonActResult.finalResponse,
                systemPrompt,
                userPrompt
            );

            // 6. Process 'next_action' tool results for handoffs and phase transitions
            const { nextResponder, phaseTransition } = await this.processNextActionResults(
                reasonActResult.allToolResults || [],
                context
            );

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
            await publishTypingStop(
                this.ndk,
                triggeringEvent,
                context.agent.signer
            );

            tracingLogger.completeOperation("agent_execution", {
                agentName: context.agent.name,
                responseLength: reasonActResult.finalContent.length,
                toolExecutions: reasonActResult.toolExecutions,
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
            await publishTypingStop(
                this.ndk,
                triggeringEvent,
                context.agent.signer
            );

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
     * Build the system and user prompts for the agent
     */
    private async buildPrompts(context: AgentExecutionContext): Promise<{ systemPrompt: string; userPrompt: string }> {
        const projectCtx = getProjectContext();
        const project = projectCtx.project;
        
        // Create tag map for efficient lookup
        const tagMap = new Map<string, string>();
        for (const tag of project.tags) {
            if (tag.length >= 2 && tag[0] && tag[1]) {
                tagMap.set(tag[0], tag[1]);
            }
        }
        
        // Check inventory availability for chat phase
        const hasInventory =
            context.phase === "chat" ? await inventoryExists(process.cwd()) : false;

        // Get all available agents for handoffs
        const availableAgents = Array.from(projectCtx.agents.values());

        // Build system prompt
        const systemPromptBuilder = new PromptBuilder()
            .add("agent-system-prompt", {
                agent: context.agent,
                phase: context.phase,
                projectTitle: tagMap.get("title") || "Untitled Project",
                projectRepository: tagMap.get("repo") || "No repository",
            })
            .add("available-agents", {
                agents: availableAgents,
                currentAgentPubkey: context.agent.pubkey,
            })
            .add("project-inventory-context", { hasInventory });

        // Add PM-specific routing instructions for PM agents
        if (context.agent.isPMAgent) {
            systemPromptBuilder
                .add("pm-routing-instructions", {})
                .add("pm-handoff-guidance", {});
        }

        const systemPrompt = systemPromptBuilder.build();

        // Build user prompt with all context
        const userPromptBuilder = new PromptBuilder()
            .add("conversation-history", {
                history: context.conversation.history,
            })
            .add("phase-context", {
                phase: context.phase,
                phaseMetadata: context.conversation.metadata,
            })
            .add("phase-constraints", {
                phase: context.phase,
            });

        const userPrompt = userPromptBuilder.build();

        return { systemPrompt, userPrompt };
    }

    /**
     * Generate initial response from LLM
     */
    private async generateResponse(
        systemPrompt: string,
        userPrompt: string,
    ): Promise<CompletionResponse> {
        const messages: Message[] = [
            { role: "system", content: systemPrompt } as Message,
            { role: "user", content: userPrompt } as Message,
        ];

        return await this.llmService.complete({
            messages,
            options: {},
        });
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

        const event = await publishAgentResponse(
            triggeringEvent,
            content,
            nextResponder || "",
            context.agent.signer,
            llmMetadata,
            additionalTags
        );

        if (tracingContext && "logEventPublished" in tracingLogger) {
            tracingLogger.logEventPublished(event.id || "unknown", "agent_response", {
                agentName: context.agent.name,
                nextResponder,
                hasLLMMetadata: !!llmMetadata,
            });
        }

        return event;
    }

    /**
     * Build LLM metadata for response tracking
     */
    private async buildLLMMetadata(
        response: CompletionResponse,
        systemPrompt: string,
        userPrompt: string
    ): Promise<LLMMetadata | undefined> {
        if (!response.usage) {
            return undefined;
        }

        // Calculate cost based on model and token usage
        const responseWithModel = response as CompletionResponse & { model?: string };
        const cost = await this.calculateCost(
            responseWithModel.model || "unknown",
            response.usage.prompt_tokens,
            response.usage.completion_tokens
        );

        return {
            model: responseWithModel.model || "unknown",
            cost,
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.prompt_tokens + response.usage.completion_tokens,
            systemPrompt,
            userPrompt,
            rawResponse: response.content,
        };
    }

    /**
     * Calculate cost based on model and token usage using OpenRouter pricing
     */
    private async calculateCost(model: string, promptTokens: number, completionTokens: number): Promise<number> {
        try {
            // Try to find exact model match first
            let modelId = await openRouterPricing.findModelId(model);
            
            // If no exact match, use the model name as-is
            if (!modelId) {
                modelId = model;
            }
            
            return await openRouterPricing.calculateCost(modelId, promptTokens, completionTokens);
        } catch (error) {
            logger.error("Failed to calculate cost using OpenRouter pricing", {
                model,
                promptTokens,
                completionTokens,
                error: error instanceof Error ? error.message : String(error),
            });
            
            // Fallback to minimal default cost calculation
            return (promptTokens + completionTokens) / 1_000_000 * 1.0; // $1 per 1M tokens
        }
    }


    /**
     * Process NextActionExecutor tool results for agent handoffs and phase transitions
     */
    private async processNextActionResults(
        toolResults: ToolExecutionResult[],
        context: AgentExecutionContext
    ): Promise<{ nextResponder: string | undefined; phaseTransition: string | undefined }> {
        let nextResponder: string | undefined = undefined;
        let phaseTransition: string | undefined = undefined;

        // Look for NextActionExecutor tool results
        const nextActionResult = toolResults.find(
            (result) => result.toolName === "next_action" && result.success && result.metadata
        );

        if (!nextActionResult?.metadata) {
            return { nextResponder, phaseTransition };
        }

        const metadata = nextActionResult.metadata;
        const actionType = metadata.actionType;

        if (actionType === "handoff") {
            // Extract target agent pubkey for handoffs
            nextResponder = metadata.targetAgentPubkey as string;
            
            logger.info("Agent handoff processed", {
                fromAgent: context.agent.name,
                fromPubkey: context.agent.pubkey,
                toAgent: metadata.targetAgentName,
                toPubkey: metadata.targetAgentPubkey,
                reason: metadata.reason,
                phase: context.phase,
            });
            
        } else if (actionType === "phase_transition") {
            // Process phase transition
            const requestedPhase = metadata.requestedPhase as string;
            phaseTransition = requestedPhase;
            
            // Update conversation phase if ConversationManager is available
            if (this.conversationManager) {
                try {
                    await this.conversationManager.updatePhase(
                        context.conversation.id,
                        requestedPhase as Phase,
                        metadata.reason as string
                    );
                    
                    logger.info("Phase transition processed", {
                        conversationId: context.conversation.id,
                        fromPhase: context.phase,
                        toPhase: requestedPhase,
                        reason: metadata.reason,
                        agentName: context.agent.name,
                    });
                } catch (error) {
                    logger.error("Failed to update conversation phase", {
                        conversationId: context.conversation.id,
                        requestedPhase,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            } else {
                logger.warn("ConversationManager not available for phase transition", {
                    conversationId: context.conversation.id,
                    requestedPhase,
                });
            }
        }

        return { nextResponder, phaseTransition };
    }


}
