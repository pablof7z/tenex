import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKProject, type NDKPrivateKeySigner, type NDKTag } from "@nostr-dev-kit/ndk";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import type { LLMMetadata } from "@/nostr/types";
import type { ContinueMetadata, CompleteMetadata } from "@/tools/types";
import { EVENT_KINDS } from "@/llm/types";
import { logger } from "@/utils/logger";
import { EXECUTION_TAGS } from "@/nostr/tags";
import { getTotalExecutionTimeSeconds } from "@/conversations/executionTime";

// Tool execution status interface (from ToolExecutionPublisher)
export interface ToolExecutionStatus {
    tool: string;
    status: "starting" | "running" | "completed" | "failed";
    args?: Record<string, unknown>;
    result?: unknown;
    error?: string;
    duration?: number;
}

// Context passed to publisher on creation
export interface NostrPublisherContext {
    ndk: NDK;
    conversation: Conversation;
    agent: Agent;
    triggeringEvent: NDKEvent;
    project: NDKProject;
}

// Options for publishing responses
export interface ResponseOptions {
    content: string;
    llmMetadata?: LLMMetadata;
    continueMetadata?: ContinueMetadata;
    completeMetadata?: CompleteMetadata;
    nextAgent?: string;
    additionalTags?: NDKTag[];
}

// Options for flushing stream content
export interface FlushOptions {
    isToolCall?: boolean;
    toolName?: string;
}

// Metadata for finalizing stream
export interface FinalizeMetadata {
    llmMetadata?: LLMMetadata;
    continueMetadata?: ContinueMetadata;
    completeMetadata?: CompleteMetadata;
    nextAgent?: string;
}

export class NostrPublisher {
    constructor(public readonly context: NostrPublisherContext) {}

    async publishResponse(options: ResponseOptions): Promise<NDKEvent> {
        try {
            const reply = this.createBaseReply();
            
            // Add content
            reply.content = options.content;
            
            // Add metadata tags
            this.addLLMMetadata(reply, options.llmMetadata);
            this.addRoutingMetadata(reply, options.continueMetadata, options.completeMetadata);
            
            // Debug logging for metadata
            logger.debug("Adding metadata to response", {
                hasLLMMetadata: !!options.llmMetadata,
                llmModel: options.llmMetadata?.model,
                llmCost: options.llmMetadata?.cost,
                hasContinueMetadata: !!options.continueMetadata,
                hasCompleteMetadata: !!options.completeMetadata
            });
            
            // Add next agent p-tag if specified
            if (options.nextAgent?.trim()) {
                reply.tag(["p", options.nextAgent]);
            }
            
            // Add any additional tags
            options.additionalTags?.forEach(tag => reply.tag(tag));
            
            // Sign and publish
            await reply.sign(this.context.agent.signer);
            await reply.publish();
            
            logger.debug("Published agent response", {
                eventId: reply.id,
                contentLength: options.content.length,
                agent: this.context.agent.name,
                phase: this.context.conversation.phase
            });
            
            return reply;
        } catch (error) {
            logger.error("Failed to publish response", {
                agent: this.context.agent.name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    async publishError(message: string): Promise<NDKEvent> {
        try {
            const reply = this.createBaseReply();
            reply.content = message;
            reply.tag(["error", "system"]);
            
            await reply.sign(this.context.agent.signer);
            await reply.publish();
            
            logger.debug("Published error notification", {
                eventId: reply.id,
                error: message,
                agent: this.context.agent.name
            });
            
            return reply;
        } catch (error) {
            logger.error("Failed to publish error", {
                agent: this.context.agent.name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    async publishTypingIndicator(state: "start" | "stop"): Promise<NDKEvent> {
        try {
            const { agent } = this.context;

            const event = new NDKEvent(this.context.ndk);
            event.kind = state === "start" ? EVENT_KINDS.TYPING_INDICATOR : EVENT_KINDS.TYPING_INDICATOR_STOP;
            event.content = state === 'start' ? `${agent.name} is typing` : "";
            
            // Add base tags (project, phase)
            this.addBaseTags(event);

            // Add conversation references
            event.tag(["e", this.context.conversation.id]);

            await event.sign(this.context.agent.signer);
            await event.publish();
            
            logger.debug(`Published typing indicator ${state}`, {
                conversationId: this.context.conversation.id,
                author: event.pubkey,
                agent: this.context.agent.name
            });
            
            return event;
        } catch (error) {
            logger.error(`Failed to publish typing indicator ${state}`, {
                agent: this.context.agent.name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    async publishToolStatus(status: ToolExecutionStatus): Promise<NDKEvent> {
        try {
            const event = this.context.triggeringEvent.reply();
            
            // Add base tags
            this.addBaseTags(event);
            
            // Add tool-specific tags
            event.tag(["tool", status.tool]);
            event.tag(["status", status.status]);
            
            // Build human-readable content (keeping existing format)
            const contentParts: string[] = [];
            
            switch (status.status) {
                case "starting":
                    contentParts.push(`🔧 Preparing to run ${status.tool}...`);
                    if (status.args) {
                        contentParts.push(`Parameters: ${JSON.stringify(status.args, null, 2)}`);
                    }
                    break;
                
                case "running":
                    contentParts.push(`🏃 Running ${status.tool}...`);
                    break;
                
                case "completed":
                    contentParts.push(`✅ ${status.tool} completed`);
                    if (status.duration) {
                        contentParts.push(`Duration: ${status.duration}ms`);
                    }
                    break;
                
                case "failed":
                    contentParts.push(`❌ ${status.tool} failed`);
                    if (status.error) {
                        contentParts.push(`Error: ${status.error}`);
                    }
                    break;
            }
            
            event.content = contentParts.join("\n");
            
            await event.sign(this.context.agent.signer);
            await event.publish();
            
            logger.debug("Published tool execution status", {
                tool: status.tool,
                status: status.status,
                eventId: event.id,
                agent: this.context.agent.name
            });
            
            return event;
        } catch (error) {
            logger.error("Failed to publish tool execution status", {
                tool: status.tool,
                status: status.status,
                agent: this.context.agent.name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    createStreamPublisher(): StreamPublisher {
        return new StreamPublisher(this);
    }

    // Private helper methods
    public createBaseReply(): NDKEvent {
        const reply = this.context.triggeringEvent.reply();
        this.addBaseTags(reply);
        this.cleanPTags(reply);
        return reply;
    }

    private addBaseTags(event: NDKEvent): void {
        // Always add project tag
        event.tag(this.context.project);
        
        // Always add current phase tag
        event.tag(["phase", this.context.conversation.phase]);
        
        // Always add execution time tag
        const totalSeconds = getTotalExecutionTimeSeconds(this.context.conversation);
        event.tag([EXECUTION_TAGS.NET_TIME, totalSeconds.toString()]);
    }

    private cleanPTags(event: NDKEvent): void {
        // Remove all p-tags added by NDK's reply() method to ensure clean routing
        event.tags = event.tags.filter(tag => tag[0] !== "p");
    }

    private addLLMMetadata(event: NDKEvent, metadata?: LLMMetadata): void {
        if (!metadata) return;
        
        event.tag(["llm-model", metadata.model]);
        event.tag(["llm-cost-usd", metadata.cost.toString()]);
        event.tag(["llm-prompt-tokens", metadata.promptTokens.toString()]);
        event.tag(["llm-completion-tokens", metadata.completionTokens.toString()]);
        event.tag(["llm-total-tokens", metadata.totalTokens.toString()]);
        
        if (metadata.contextWindow) {
            event.tag(["llm-context-window", metadata.contextWindow.toString()]);
        }
        if (metadata.maxCompletionTokens) {
            event.tag(["llm-max-completion-tokens", metadata.maxCompletionTokens.toString()]);
        }
        if (metadata.systemPrompt) {
            event.tag(["llm-system-prompt", metadata.systemPrompt]);
        }
        if (metadata.userPrompt) {
            event.tag(["llm-user-prompt", metadata.userPrompt]);
        }
        if (metadata.rawResponse) {
            event.tag(["llm-raw-response", metadata.rawResponse]);
        }
    }

    private addRoutingMetadata(event: NDKEvent, continueMetadata?: ContinueMetadata, completeMetadata?: CompleteMetadata): void {
        if (continueMetadata) {
            event.tag(["routing", "continue"]);
            if (continueMetadata.routingDecision.phase) {
                event.tag(["new-phase", continueMetadata.routingDecision.phase]);
            }
        } else if (completeMetadata) {
            event.tag(["routing", "complete"]);
        }
        // Only add phase-transition tag if we have routing metadata
        if (continueMetadata || completeMetadata) {
            event.tag(["phase-transition", "true"]);
            event.tag(["phase-from", this.context.conversation.phase]);
        }
    }
}

export class StreamPublisher {
    private contentBuffer = "";
    private fullContent = "";
    private sequence = 0;
    private hasFinalized = false;

    constructor(private readonly publisher: NostrPublisher) {}

    addContent(content: string): void {
        this.contentBuffer += content;
        this.fullContent += content;
    }

    async flush(options?: FlushOptions): Promise<void> {
        if (!this.contentBuffer.trim() || this.hasFinalized) return;

        try {
            // Use the protected method to create a pre-tagged reply
            const reply = this.publisher.createBaseReply();

            // Add streaming tags
            this.sequence++;
            reply.tag(["streaming", "true"]);
            reply.tag(["partial", "true"]);
            reply.tag(["sequence", this.sequence.toString()]);
            
            if (options?.isToolCall && options?.toolName) {
                reply.tag(["tool_call", options.toolName]);
            }

            reply.content = this.contentBuffer;
            
            await reply.sign(this.publisher.context.agent.signer);
            await reply.publish();
            
            logger.debug("Flushed streaming content", {
                sequence: this.sequence,
                contentLength: this.contentBuffer.length,
                agent: this.publisher.context.agent.name
            });
            
            this.contentBuffer = "";
        } catch (error) {
            logger.error("Failed to flush streaming content", {
                sequence: this.sequence,
                agent: this.publisher.context.agent.name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    async finalize(metadata: FinalizeMetadata): Promise<NDKEvent> {
        if (this.hasFinalized) {
            throw new Error("Stream already finalized");
        }

        try {
            // Only flush remaining content if we've had tool calls
            // Otherwise we'll create duplicate events (one from flush, one from publishResponse)
            if (this.contentBuffer && this.sequence > 0) {
                await this.flush();
            }

            // Publish final response with full content
            const finalEvent = await this.publisher.publishResponse({
                content: this.fullContent,
                ...metadata
            });

            this.hasFinalized = true;
            
            logger.debug("Finalized streaming response", {
                totalSequences: this.sequence,
                fullContentLength: this.fullContent.length,
                agent: this.publisher.context.agent.name
            });
            
            return finalEvent;
        } catch (error) {
            logger.error("Failed to finalize streaming response", {
                agent: this.publisher.context.agent.name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    isFinalized(): boolean {
        return this.hasFinalized;
    }

    getFullContent(): string {
        return this.fullContent;
    }

    getSequenceNumber(): number {
        return this.sequence;
    }
}