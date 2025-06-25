import type { CompletionResponse, LLMService } from "@/llm/types";
import { Message } from "multi-llm-ts";
import { publishAgentResponse, publishTypingStart, publishTypingStop } from "@/nostr";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type NDK from "@nostr-dev-kit/ndk";
import { PromptBuilder } from "@/prompts";
import { getProjectContext } from "@/services";
import { buildHistoryMessages, needsCurrentUserMessage, getLatestUserMessage } from "@/prompts/utils/messageBuilder";
import {
    type TracingContext,
    type TracingLogger,
    createTracingContext,
    createAgentExecutionContext,
    createTracingLogger,
} from "@/tracing";
import type { Phase } from "@/conversations/phases";
import type { LLMMetadata } from "@/nostr/types";
import { inventoryExists, loadInventoryContent } from "@/utils/inventory";
import type { NDKEvent, NDKTag } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import type { AgentExecutionContext, AgentExecutionResult } from "./types";
import { ReasonActLoop } from "./ReasonActLoop";
import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";
import type { ToolExecutionResult, ToolResult, HandoffMetadata, PhaseTransitionMetadata } from "@/tools/types";
import { isHandoffMetadata, isPhaseTransitionMetadata } from "@/tools/types";
import { getDefaultToolsForAgent } from "@/agents/constants";
import type { ConversationManager } from "@/conversations/ConversationManager";
import { buildLLMMetadata } from "@/prompts/utils/llmMetadata";
import { getTool } from "@/tools/registry";
import { executeTools } from "@/tools/toolExecutor";
import "@/prompts/fragments/available-agents";
import "@/prompts/fragments/pm-routing";
import "@/prompts/fragments/default-to-action";
import "@/prompts/fragments/expertise-boundaries";
import { TaskPublisher } from "@/nostr/TaskPublisher";

export class AgentExecutor {
    private reasonActLoop: ReasonActLoop;
    private taskPublisher: TaskPublisher;

    constructor(
        private llmService: LLMService,
        private ndk: NDK,
        private conversationManager?: ConversationManager
    ) {
        this.reasonActLoop = new ReasonActLoop(llmService);
        this.taskPublisher = new TaskPublisher(this.ndk);
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

            // 2. Build the agent's messages
            const messages = await this.buildMessages({
                ...context,
                agent: agentWithPhaseTools,
            });

            // 3. Publish typing indicator start
            await publishTypingStart(
                this.ndk,
                triggeringEvent,
                context.agent.signer
            );

            const initialResponse = await this.generateResponse(messages);

            // Build initial LLM metadata
            const initialLLMMetadata = await this.buildLLMMetadata(
                initialResponse,
                messages
            );

            // Check if response contains tool invocations
            const hasTools = this.containsTools(initialResponse.content || "");
            
            let finalResponse: CompletionResponse;
            let finalContent: string;
            let allToolResults: ToolExecutionResult[] = [];
            let llmMetadata: LLMMetadata | undefined;

            if (hasTools) {
                // Execute the Reason-Act loop only if there are tools
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
                        eventToReply: triggeringEvent, // Pass the triggering event for phase updates
                    },
                    messages,
                    tracingContext,
                    initialLLMMetadata
                );
                
                finalResponse = reasonActResult.finalResponse;
                finalContent = reasonActResult.finalContent;
                allToolResults = reasonActResult.allToolResults || [];
                
                // Build metadata with final response from ReasonActLoop
                llmMetadata = await this.buildLLMMetadata(
                    finalResponse,
                    messages
                );
            } else {
                // No tools, use initial response directly
                finalResponse = initialResponse;
                finalContent = initialResponse.content || "";
                llmMetadata = initialLLMMetadata;
                
                tracingLogger.debug("No tools detected, skipping Reason-Act loop", {
                    agent: context.agent.name,
                    responseLength: finalContent.length
                });
            }

            // 6. Process handoff and phase transition tool results
            // Ensure projectPath is set in context
            if (!context.projectPath) {
                context.projectPath = process.cwd();
            }
            const { nextResponder, phaseTransition } = await this.processFlowControlResults(
                allToolResults,
                context
            );

            // 8. Publish response to Nostr
            const publishedEvent = await this.publishResponse(
                context,
                triggeringEvent,
                finalContent,
                nextResponder,
                llmMetadata,
                tracingContext,
                phaseTransition
            );

            // Log the agent response in human-readable format
            logger.agentResponse(
                context.agent.name,
                finalContent,
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
                responseLength: finalContent.length,
                toolExecutions: allToolResults.length,
                nextAgent: nextResponder,
            });

            return {
                success: true,
                response: finalContent,
                llmMetadata,
                toolExecutions: allToolResults,
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
     * Build the messages array for the agent execution
     */
    private async buildMessages(context: AgentExecutionContext): Promise<Message[]> {
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
        
        // Load inventory content if available
        let inventoryContent: string | null = null;
        if (hasInventory) {
            inventoryContent = await loadInventoryContent(process.cwd());
        }
        
        // Get list of context files
        let contextFiles: string[] = [];
        try {
            const contextDir = path.join(process.cwd(), "context");
            const files = await fs.readdir(contextDir);
            contextFiles = files.filter(f => f.endsWith(".md"));
        } catch (error) {
            // Context directory may not exist
            logger.debug("Could not read context directory", { error });
        }

        // Get all available agents for handoffs
        const availableAgents = Array.from(projectCtx.agents.values());

        const messages: Message[] = [];
        
        // Build system prompt with all agent and phase context
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
            .add("project-inventory-context", { 
                hasInventory, 
                inventoryContent: inventoryContent || undefined,
                contextFiles 
            })
            // Move phase context and constraints to system prompt
            .add("phase-context", {
                phase: context.phase,
                phaseMetadata: context.conversation.metadata,
                conversation: context.conversation,
            })
            .add("phase-constraints", {
                phase: context.phase,
            });

        // Add PM-specific routing instructions for PM agents
        if (context.agent.isPMAgent) {
            systemPromptBuilder
                .add("default-to-action", {})
                .add("pm-routing-instructions", {})
                .add("pm-handoff-guidance", {});
            
            // Add Claude Code report fragment if we have one
            if (context.additionalContext?.claudeCodeReport) {
                systemPromptBuilder.add("claude-code-report", {
                    phase: context.phase,
                    previousPhase: context.previousPhase,
                    claudeCodeReport: context.additionalContext.claudeCodeReport
                });
            }
        } else {
            // Add expertise boundaries for specialist agents
            systemPromptBuilder.add("expertise-boundaries", {
                agentRole: context.agent.role || "specialist",
                isPMAgent: false
            });
        }

        const systemPrompt = systemPromptBuilder.build();
        messages.push(new Message("system", systemPrompt));
        
        // Add conversation history as proper messages
        const historyMessages = buildHistoryMessages(context.conversation.history);
        messages.push(...historyMessages);
        
        // Add current user message if needed
        if (needsCurrentUserMessage(context.conversation)) {
            const latestUserMessage = getLatestUserMessage(context.conversation);
            if (latestUserMessage) {
                messages.push(new Message("user", latestUserMessage));
            }
        }
        
        return messages;
    }

    /**
     * Generate initial response from LLM
     */
    private async generateResponse(
        messages: Message[]
    ): Promise<CompletionResponse> {
        return await this.llmService.complete({
            messages,
            options: {},
        });
    }

    /**
     * Check if content contains tool invocations
     */
    private containsTools(content: string): boolean {
        // Only check for modern JSON tool format
        return /<tool_use>/.test(content);
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
                preview: content.substring(0, 60),
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
        messages: Message[]
    ): Promise<LLMMetadata | undefined> {
        const responseWithUsage = {
            usage: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.prompt_tokens + response.usage.completion_tokens
            } : undefined,
            model: 'model' in response && typeof response.model === 'string' ? response.model : undefined,
            experimental_providerMetadata: 'experimental_providerMetadata' in response ? response.experimental_providerMetadata : undefined
        };

        const metadata = await buildLLMMetadata(
            responseWithUsage,
            responseWithUsage.model || "unknown",
            messages
        );

        if (!metadata) {
            return undefined;
        }

        // Add additional metadata specific to AgentExecutor
        const responseWithModel = response as CompletionResponse & { 
            contextWindow?: number;
            maxCompletionTokens?: number;
        };

        return {
            ...metadata,
            promptTokens: metadata.usage.prompt_tokens,
            completionTokens: metadata.usage.completion_tokens,
            totalTokens: metadata.usage.total_tokens,
            contextWindow: responseWithModel.contextWindow,
            maxCompletionTokens: responseWithModel.maxCompletionTokens,
            rawResponse: response.content,
        };
    }


    /**
     * Process switch_phase and handoff tool results
     */
    private async processFlowControlResults(
        toolResults: ToolExecutionResult[],
        context: AgentExecutionContext
    ): Promise<{ nextResponder: string | undefined; phaseTransition: string | undefined }> {
        let nextResponder: string | undefined = undefined;
        let phaseTransition: string | undefined = undefined;

        logger.info('🔍 Processing special tool results', {
            agent: context.agent.name,
            totalResults: toolResults.length,
            tools: toolResults.map(r => r.toolName)
        });

        // Look for handoff tool results
        const handoffResult = toolResults.find(
            (result) => result.toolName === "handoff" && result.success
        );

        if (handoffResult?.metadata && isHandoffMetadata(handoffResult.metadata)) {
            const handoffData = handoffResult.metadata.handoff;
            
            // Handle handoff to user (no next responder needed)
            if (handoffData.to === 'user') {
                logger.info("🤝 Handoff to user processed", {
                    fromAgent: context.agent.name,
                    fromPubkey: context.agent.pubkey,
                    message: handoffData.message,
                    phase: context.phase,
                });
                // Don't set nextResponder for user handoffs
            } else {
                // Handle handoff to agent
                nextResponder = handoffData.to;
                
                logger.info("🤝 Agent handoff processed", {
                    fromAgent: context.agent.name,
                    fromPubkey: context.agent.pubkey,
                    toAgent: handoffData.toName,
                    toPubkey: handoffData.to,
                    message: handoffData.message,
                    phase: context.phase,
                });
            }
        }

        // Look for switch_phase tool results
        const switchPhaseResult = toolResults.find(
            (result) => result.toolName === "switch_phase" && result.success
        );

        if (switchPhaseResult?.metadata && isPhaseTransitionMetadata(switchPhaseResult.metadata)) {
            const phaseData = switchPhaseResult.metadata.phaseTransition;
            const requestedPhase = phaseData.to;
            const transitionMessage = phaseData.message;
            phaseTransition = requestedPhase;
            
            logger.info("🔄 Phase transition requested", {
                agent: context.agent.name,
                fromPhase: context.phase,
                toPhase: requestedPhase,
                reason: phaseData.reason,
                message: transitionMessage
            });
            
            // Update conversation phase if ConversationManager is available
            if (this.conversationManager) {
                try {
                    await this.conversationManager.updatePhase(
                        context.conversation.id,
                        requestedPhase as Phase,
                        transitionMessage,
                        context.agent.pubkey,
                        context.agent.name,
                        phaseData.reason
                    );
                    
                    logger.info("✅ Phase transition processed", {
                        conversationId: context.conversation.id,
                        fromPhase: context.phase,
                        toPhase: requestedPhase,
                        directClaudeCode: requestedPhase === 'plan' || requestedPhase === 'execute'
                    });
                    
                    // Direct Claude Code invocation for plan/execute phases
                    if (requestedPhase === 'plan' || requestedPhase === 'execute') {
                        // Add safeguards to prevent infinite loops or unexpected behavior
                        const shouldAutoInvoke = this.shouldAutoInvokeClaudeCode(context, requestedPhase);
                        
                        if (shouldAutoInvoke) {
                            const claudeResult = await this.invokeClaudeCodeDirectly(
                                transitionMessage,
                                requestedPhase,
                                context
                            );
                            
                            // Store result for PM agent to process
                            context.additionalContext = {
                                claudeCodeReport: claudeResult.output,
                                claudeCodeSuccess: claudeResult.success,
                                directExecution: true
                            };
                        }
                    }
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

    /**
     * Invoke Claude Code directly for plan/execute phases with NDK task publishing
     */
    private async invokeClaudeCodeDirectly(
        message: string,
        phase: string,
        context: AgentExecutionContext
    ): Promise<ToolResult> {
        try {
            // Get conversation root event ID (first event in history)
            const conversationRootEventId = context.conversation.history[0]?.id;
            
            // Execute Claude Code with full task tracking
            const { task, result } = await this.taskPublisher.executeWithTask({
                prompt: message,
                projectPath: context.projectPath || process.cwd(),
                title: `Claude Code ${phase === 'plan' ? 'Planning' : 'Execution'}`,
                branch: context.conversation.metadata.branch,
                conversationRootEventId
            });
            
            // Return assistant messages as output, with metadata including task ID
            return {
                success: result.success,
                output: result.assistantMessages.join('\n\n'),
                error: result.error,
                metadata: {
                    taskId: task.id,
                    rawOutput: result.output,
                    sessionId: result.sessionId,
                    totalCost: result.totalCost,
                    messageCount: result.messageCount,
                    duration: result.duration
                }
            };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Claude Code execution failed' 
            };
        }
    }

    /**
     * Safeguard method to determine if automatic invocation should occur
     */
    private shouldAutoInvokeClaudeCode(
        context: AgentExecutionContext, 
        phase: string
    ): boolean {
        // Prevent auto-invocation if already in a claude_code execution context
        return !context.additionalContext?.directExecution;
    }

}
