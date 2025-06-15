import type { NDKEvent, NDKProject } from "@nostr-dev-kit/ndk";
import { EVENT_KINDS } from "@tenex/types/events";
import type { Conversation } from "../Conversation";
import { getConversationStats, optimizeForContextWindow } from "../ConversationOptimizer";
import { LLMConfigManager } from "../llm/LLMConfigManager";
import { createLLMProvider } from "../llm/LLMFactory";
import type { LLMMessage, LLMResponse as LLMProviderResponse } from "../llm/types";
import type { AgentResponse, LLMConfig } from "../types";
import type { AgentConversationManager } from "./AgentConversationManager";
import type { AgentCore } from "./AgentCore";

export class AgentResponseGenerator {
    private agentCore: AgentCore;
    private conversationManager: AgentConversationManager;

    constructor(agentCore: AgentCore, conversationManager: AgentConversationManager) {
        this.agentCore = agentCore;
        this.conversationManager = conversationManager;
    }

    async generateResponse(
        conversationId: string,
        llmConfig?: LLMConfig,
        projectPath?: string,
        isFromAgent = false,
        typingIndicatorCallback?: (message: string) => Promise<void>
    ): Promise<AgentResponse> {
        this.agentCore
            .getLogger()
            .debug(
                ` AgentResponseGenerator.generateResponse called for conversation: ${conversationId}`
            );
        const conversation = this.conversationManager.getConversation(conversationId);
        if (!conversation) {
            this.agentCore
                .getLogger()
                .error(`[DEBUG] Conversation ${conversationId} not found in conversationManager!`);
            throw new Error(`Conversation ${conversationId} not found`);
        }
        this.agentCore
            .getLogger()
            .debug(` Found conversation with ${conversation.getMessageCount()} messages`);
        const messages = conversation.getMessages();
        messages.forEach((msg, idx) => {
            this.agentCore
                .getLogger()
                .debug(
                    ` Conversation message ${idx}: ${msg.role} - "${msg.content.substring(0, 100)}..."`
                );
        });

        const config = llmConfig || this.agentCore.getDefaultLLMConfig();
        if (!config) {
            throw new Error("No LLM configuration available");
        }

        this.agentCore
            .getLogger()
            .info(
                `🤖 Agent '${this.agentCore.getName()}' using LLM: ${config.provider}/${config.model}`
            );

        try {
            // Prepare messages for LLM
            const messages = this.prepareMessagesForLLM(conversation, config, isFromAgent);

            // Log debug information
            this.logLLMRequest(conversationId, config, conversation, messages);

            // Generate response
            this.agentCore
                .getLogger()
                .info(
                    `Generating response for conversation ${conversationId} using ${config.provider}/${config.model}`
                );
            const provider = createLLMProvider(config, this.agentCore.getToolRegistry());

            // Get project event from agent manager - REQUIRED
            const agentManager = this.agentCore.getAgentManager();
            if (!agentManager?.projectInfo?.projectEvent) {
                throw new Error(
                    "Project event not found - cannot generate response without project context"
                );
            }

            const projectEvent = agentManager.projectInfo.projectEvent;
            const ndk = this.agentCore.getNDK();
            if (!ndk) {
                throw new Error("NDK not found - cannot generate response without NDK context");
            }

            const context = {
                agentName: this.agentCore.getName(),
                projectName: this.agentCore.getProjectName(),
                conversationId,
                typingIndicator: typingIndicatorCallback,
                agent: this.agentCore,
                agentEventId: this.agentCore.getAgentEventId(),
                ndk,
                projectEvent,
            };
            const response = await provider.generateResponse(messages, config, context);

            // Log the raw response from the model
            this.logLLMResponse(response, config);

            // Save the response
            await this.saveResponseToConversation(conversation, response);

            // Return structured response
            const agentResponse = this.createAgentResponse(response, config, messages);

            // Check if provider has renderInChat data (from tool execution)
            if (
                provider instanceof (await import("../llm/ToolEnabledProvider")).ToolEnabledProvider
            ) {
                const renderInChat = provider.getLastRenderInChat();
                if (renderInChat) {
                    agentResponse.renderInChat = renderInChat;
                    this.agentCore
                        .getLogger()
                        .debug("Added renderInChat data to agent response:", renderInChat);
                }
            }

            return agentResponse;
        } catch (error: unknown) {
            // Log detailed error information
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.agentCore
                .getLogger()
                .error(`LLM Error: ${errorMessage} (${config.provider}/${config.model})`);

            // Handle cache control errors gracefully
            if (this.isCacheControlError(error) && config.enableCaching !== false && projectPath) {
                return this.handleCacheControlError(
                    conversationId,
                    config,
                    projectPath,
                    llmConfig,
                    isFromAgent,
                    typingIndicatorCallback
                );
            }

            throw error;
        }
    }

    private prepareMessagesForLLM(
        conversation: Conversation,
        config: LLMConfig,
        isFromAgent = false
    ): LLMMessage[] {
        let messages = conversation.getFormattedMessages();

        // If this is an agent-to-agent interaction, add a special system message
        if (isFromAgent && messages.length > 0) {
            const agentToAgentPrompt = {
                role: "system" as const,
                content:
                    "\n[AGENT-TO-AGENT COMMUNICATION]\nYou are responding to another AI agent. Only respond if you have something VERY relevant or important to add to the conversation. If you don't have anything meaningful to contribute, simply respond with 'I have nothing to add.' to pass your turn. Avoid redundant or trivial responses.",
            };

            // Insert after the main system prompt
            const systemMessageIndex = messages.findIndex((msg) => msg.role === "system");
            if (systemMessageIndex >= 0) {
                messages.splice(systemMessageIndex + 1, 0, agentToAgentPrompt);
            } else {
                messages.unshift(agentToAgentPrompt);
            }
        }

        const contextWindowSize = config.contextWindowSize || 128000;
        const stats = getConversationStats(messages);

        if (!stats.withinStandardContext) {
            this.agentCore
                .getLogger()
                .warning(
                    `Conversation exceeds context window (${stats.estimatedTokens} tokens, ${stats.percentOfContext.toFixed(1)}% of limit)`
                );
            messages = optimizeForContextWindow(messages, contextWindowSize);
            this.agentCore
                .getLogger()
                .info(`Optimized conversation to ${messages.length} messages`);
        }

        return messages;
    }

    private logLLMRequest(
        _conversationId: string,
        config: LLMConfig,
        _conversation: Conversation,
        messages: LLMMessage[]
    ): void {
        const _contextWindowSize = config.contextWindowSize || 128000;
        const stats = getConversationStats(messages);

        this.agentCore
            .getLogger()
            .debug(
                `LLM Request: ${config.provider}/${config.model}, ${messages.length} messages, ~${stats.estimatedTokens} tokens (${stats.percentOfContext.toFixed(1)}% of context)`
            );

        // Debug log all messages being sent to LLM provider
        // Log message count and user prompt only
        const userMessage = messages.find((msg) => msg.role === "user");
        this.agentCore.getLogger().debug(`Prepared ${messages.length} messages for LLM`);
        if (userMessage) {
            this.agentCore
                .getLogger()
                .debug(`User prompt: "${userMessage.content.substring(0, 100)}..."`);
        }
    }

    private logLLMResponse(response: LLMProviderResponse, _config: LLMConfig): void {
        if (response.usage) {
            const cost = response.usage.cost ? ` ($${response.usage.cost.toFixed(6)})` : "";
            const cacheInfo = response.usage.cache_read_input_tokens
                ? ` [${response.usage.cache_read_input_tokens} cached]`
                : "";
            this.agentCore
                .getLogger()
                .info(`Response: ${response.usage.completion_tokens} tokens${cacheInfo}${cost}`);
        }
    }

    private async saveResponseToConversation(
        conversation: Conversation,
        response: LLMProviderResponse
    ): Promise<void> {
        conversation.addAssistantMessage(response.content);
        await this.conversationManager.saveConversationToStorage(conversation);
    }

    private createAgentResponse(
        response: LLMProviderResponse,
        config: LLMConfig,
        messages?: LLMMessage[]
    ): AgentResponse {
        // Extract system prompt and user prompt from messages
        let systemPrompt: string | undefined;
        let userPrompt: string | undefined;

        this.agentCore.getLogger().debug("\n=== CREATE AGENT RESPONSE DEBUG ===");
        this.agentCore.getLogger().debug(`Messages provided: ${!!messages}`);
        this.agentCore.getLogger().debug(`Messages length: ${messages?.length || 0}`);

        if (messages) {
            // Find system prompt
            const systemMessage = messages.find((msg) => msg.role === "system");
            this.agentCore.getLogger().debug(`System message found: ${!!systemMessage}`);
            if (systemMessage) {
                systemPrompt = systemMessage.content;
                this.agentCore.getLogger().debug(`System prompt length: ${systemPrompt.length}`);

                // Add tool information to system prompt if tools are available
                const toolRegistry = this.agentCore.getToolRegistry();
                if (toolRegistry) {
                    const availableTools = toolRegistry.getAllTools();
                    if (availableTools.length > 0) {
                        const toolPrompt = toolRegistry.generateSystemPrompt();
                        systemPrompt = `${systemPrompt}\n\n${toolPrompt}`;
                    }
                }
            }

            // Get the last user message as the user prompt
            const userMessages = messages.filter((msg) => msg.role === "user");
            this.agentCore.getLogger().debug(`User messages found: ${userMessages.length}`);
            userMessages.forEach((msg, idx) => {
                this.agentCore
                    .getLogger()
                    .debug(`  User message ${idx}: "${msg.content.substring(0, 100)}..."`);
            });

            if (userMessages.length > 0) {
                userPrompt = userMessages[userMessages.length - 1].content;
                this.agentCore
                    .getLogger()
                    .debug(`Final user prompt selected: "${userPrompt.substring(0, 100)}..."`);
            } else {
                this.agentCore
                    .getLogger()
                    .debug("No user messages found - userPrompt will be undefined");
            }
        } else {
            this.agentCore.getLogger().debug("No messages provided to createAgentResponse");
        }

        this.agentCore
            .getLogger()
            .debug(
                `Final userPrompt: ${userPrompt ? `"${userPrompt.substring(0, 100)}..."` : "undefined"}`
            );
        this.agentCore
            .getLogger()
            .debug(
                `Final systemPrompt: ${systemPrompt ? `"${systemPrompt.substring(0, 100)}..."` : "undefined"}`
            );
        this.agentCore.getLogger().debug("=== END CREATE AGENT RESPONSE DEBUG ===\n");

        return {
            content: response.content,
            confidence: 0.8, // TODO: Calculate based on response quality
            metadata: {
                model: response.model || config.model,
                provider: config.provider,
                usage: response.usage,
                systemPrompt,
                userPrompt,
            },
        };
    }

    private isCacheControlError(error: unknown): boolean {
        if (error instanceof Error) {
            return error.message.includes("No endpoints found that support cache control");
        }
        return false;
    }

    private async handleCacheControlError(
        conversationId: string,
        config: LLMConfig,
        projectPath: string,
        _originalConfig?: LLMConfig,
        isFromAgent = false,
        typingIndicatorCallback?: (message: string) => Promise<void>
    ): Promise<AgentResponse> {
        this.agentCore
            .getLogger()
            .warning(
                `Model ${config.model} does not support cache control. Disabling caching for this configuration.`
            );

        // Disable caching for this specific config
        config.enableCaching = false;

        // Update the llms.json file to persist this change
        const configManager = new LLMConfigManager(projectPath);
        await configManager.disableCachingForConfig(config);

        // Retry the request without caching
        this.agentCore.getLogger().info("Retrying request without cache control...");
        return this.generateResponse(
            conversationId,
            config,
            projectPath,
            isFromAgent,
            typingIndicatorCallback
        );
    }
}
