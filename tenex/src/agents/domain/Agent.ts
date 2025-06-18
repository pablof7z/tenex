import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import { type NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
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

        // Generate response
        const completion = await this.llm.complete({
            messages,
            context: {
                agentName: this.config.name,
                conversationId: context.conversationId,
                eventId: event.id,
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
    }

    public getSystemPrompt(): string {
        return this.buildSystemPrompt();
    }

    protected buildSystemPrompt(): string {
        let prompt = `You are ${this.config.name}, ${this.config.role}.

Instructions: ${this.config.instructions}
`;

        // Add tool instructions if agent has tools
        if (this.toolRegistry) {
            const toolPrompt = this.toolRegistry.generateSystemPrompt();
            if (toolPrompt) {
                prompt += `\n${toolPrompt}\n`;
            }
        }

        prompt += `
When responding, you should indicate the conversation state using one of these signals:
- continue: You have more to say in this conversation phase
- ready_for_transition: You've completed your part and are ready for the next phase
- need_input: You need input from another team member
- blocked: You're blocked and need help
- complete: The entire task/conversation is complete

Format your response as:
[Your response content]

SIGNAL: <signal_type>
REASON: <optional reason for the signal>`;

        return prompt;
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
