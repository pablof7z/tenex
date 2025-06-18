import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import { type NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { SystemPromptComposer } from "../../prompts";
import { enhanceWithTypingIndicators } from "../infrastructure/LLMProviderAdapter";
import type {
    AgentConfig,
    AgentResponse,
    ConversationSignal,
    ConversationStore,
    EventContext,
    LLMConfig,
    LLMProvider,
    Message,
    NostrPublisher,
} from "../core/types";

export class Agent {
    protected signer: NDKPrivateKeySigner;
    protected pubkey: string;
    private isActiveSpeaker = false;
    protected teamSize: number = 1; // Default to single agent
    private typingAwareLLM: LLMProvider;

    constructor(
        protected config: AgentConfig,
        protected llm: LLMProvider,
        protected store: ConversationStore,
        protected publisher: NostrPublisher,
        protected ndk: NDK,
        protected toolRegistry?: ToolRegistry
    ) {
        this.signer = new NDKPrivateKeySigner(config.nsec);
        this.pubkey = this.signer.pubkey;
        
        // Enhance LLM provider with typing indicators
        this.typingAwareLLM = enhanceWithTypingIndicators(
            llm,
            publisher,
            config.name,
            this.signer
        );
    }

    setTeamSize(size: number): void {
        this.teamSize = size;
    }

    async initialize(): Promise<void> {
        // Get actual pubkey from signer
        const user = await this.signer.user();
        this.pubkey = user.pubkey;
        logger.info(`Initialized agent ${this.config.name} with pubkey ${this.pubkey}`);
    }

    getName(): string {
        return this.config.name;
    }

    getSigner(): NDKPrivateKeySigner {
        return this.signer;
    }

    getPubkey(): string {
        return this.pubkey;
    }

    getConfig(): AgentConfig {
        return this.config;
    }

    setActiveSpeaker(active: boolean): void {
        this.isActiveSpeaker = active;
        logger.debug(`Agent ${this.config.name} active speaker: ${active}`);
    }

    async handleEvent(event: NDKEvent, context: EventContext): Promise<void> {
        // Only respond if we're an active speaker
        if (!this.isActiveSpeaker) {
            logger.debug(`Agent ${this.config.name} ignoring event - not active speaker`);
            return;
        }

        // CRITICAL: Never respond to our own events
        if (event.pubkey === this.pubkey) {
            logger.warn(
                `Agent ${this.config.name} attempted to respond to its own event - ignoring`
            );
            return;
        }

        const response = await this.generateResponse(event, context);
        await this.publisher.publishResponse(response, context, this.signer);
    }

    async generateResponse(event: NDKEvent, context: EventContext): Promise<AgentResponse> {
        // Build conversation history
        const messages = await this.buildConversationContext(event, context);

        // Build system prompt
        const systemPrompt = this.buildSystemPrompt();

        // Add system prompt with signal instructions
        messages.unshift({
            role: "system",
            content: systemPrompt,
        });

        try {
            // Generate response (typing indicators are handled automatically by typingAwareLLM)
            const completion = await this.typingAwareLLM.complete({
                messages,
                context: {
                    agentName: this.config.name,
                    conversationId: context.conversationId,
                    eventId: event.id,
                    originalEvent: context.originalEvent,
                    projectId: context.projectId,
                    projectEvent: context.projectEvent,
                    ndk: this.ndk,
                },
            });

            // Parse response and extract signal
            const { content, signal } = this.parseResponse(completion.content);

            // Save to conversation history
            await this.store.appendMessage(context.conversationId, {
                id: `${Date.now()}-${this.config.name}`,
                agentName: this.config.name,
                content,
                timestamp: Date.now(),
                signal,
            });

            // Build metadata from completion
            const metadata: import("../core/types").LLMMetadata = {
                model: completion.model,
                provider: this.config.llmConfig?.provider,
                systemPrompt,
                userPrompt: event.content,
                usage: completion.usage
                    ? {
                          promptTokens: completion.usage.promptTokens,
                          completionTokens: completion.usage.completionTokens,
                          totalTokens: completion.usage.totalTokens,
                          cacheCreationTokens: completion.usage.cacheCreationTokens,
                          cacheReadTokens: completion.usage.cacheReadTokens,
                          cost: completion.usage.cost,
                      }
                    : undefined,
            };

            return { content, signal, metadata };
        } catch (error) {
            throw error;
        }
    }

    public getSystemPrompt(): string {
        return this.buildSystemPrompt();
    }

    protected buildSystemPrompt(): string {
        return SystemPromptComposer.composeAgentPrompt({
            name: this.config.name,
            role: this.config.role,
            instructions: this.config.instructions,
            teamSize: this.teamSize,
            toolDescriptions: this.toolRegistry?.generateSystemPrompt(),
        });
    }

    protected async buildConversationContext(
        event: NDKEvent,
        context: EventContext
    ): Promise<Message[]> {
        const messages: Message[] = [];

        // Get conversation history
        const history = await this.store.getMessages(context.conversationId);

        // Add recent history (last 10 messages for context)
        const recentHistory = history.slice(-10);
        for (const msg of recentHistory) {
            messages.push({
                role: "assistant",
                content: `${msg.agentName}: ${msg.content}`,
            });
        }

        // Add current user message
        messages.push({
            role: "user",
            content: event.content,
        });

        return messages;
    }

    protected parseResponse(rawContent: string): { content: string; signal?: ConversationSignal } {
        const lines = rawContent.split("\n");
        const content = [];
        let signal: ConversationSignal | undefined;
        let inSignalSection = false;

        for (const line of lines) {
            if (line.startsWith("SIGNAL:")) {
                inSignalSection = true;
                const signalType = line.replace("SIGNAL:", "").trim() as ConversationSignal["type"];
                signal = { type: signalType };
            } else if (inSignalSection && line.startsWith("REASON:")) {
                if (signal) {
                    signal.reason = line.replace("REASON:", "").trim();
                }
            } else if (!inSignalSection) {
                content.push(line);
            }
        }

        return {
            content: content.join("\n").trim(),
            signal,
        };
    }
}
