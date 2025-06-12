import type { ConversationMessage } from "./types";

export class ConversationOptimizer {
	private static readonly DEFAULT_CONTEXT_WINDOW = 128000; // Claude 3 default
	private static readonly RESERVE_TOKENS = 4096; // Reserve for response

	/**
	 * Optimize conversation for context window limits
	 * Implements a sliding window approach to keep most recent messages
	 */
	static optimizeForContextWindow(
		messages: ConversationMessage[],
		maxTokens: number = this.DEFAULT_CONTEXT_WINDOW,
	): ConversationMessage[] {
		const effectiveLimit = maxTokens - this.RESERVE_TOKENS;

		// Always keep system message if present
		const systemMessage = messages.find((m) => m.role === "system");
		const conversationMessages = messages.filter((m) => m.role !== "system");

		// Rough token estimation (4 chars = 1 token)
		const estimateTokens = (msg: ConversationMessage) =>
			Math.ceil(msg.content.length / 4);

		// Start with system message tokens
		let totalTokens = systemMessage ? estimateTokens(systemMessage) : 0;
		const optimizedMessages: ConversationMessage[] = [];

		// Add messages from most recent backwards until we hit limit
		for (let i = conversationMessages.length - 1; i >= 0; i--) {
			const msgTokens = estimateTokens(conversationMessages[i]);
			if (totalTokens + msgTokens > effectiveLimit) {
				break;
			}
			optimizedMessages.unshift(conversationMessages[i]);
			totalTokens += msgTokens;
		}

		// Add system message at the beginning if it exists
		if (systemMessage) {
			optimizedMessages.unshift(systemMessage);
		}

		return optimizedMessages;
	}

	/**
	 * Summarize older messages to preserve context while reducing tokens
	 * This is a placeholder - would need LLM to actually summarize
	 */
	static async summarizeOldMessages(
		messages: ConversationMessage[],
		keepLast = 10,
	): Promise<ConversationMessage[]> {
		if (messages.length <= keepLast) {
			return messages;
		}

		const systemMessage = messages.find((m) => m.role === "system");
		const conversationMessages = messages.filter((m) => m.role !== "system");

		// Keep recent messages as-is
		const recentMessages = conversationMessages.slice(-keepLast);
		const oldMessages = conversationMessages.slice(0, -keepLast);

		// Create a summary placeholder (in real implementation, use LLM to summarize)
		const summaryMessage: ConversationMessage = {
			role: "assistant",
			content: `[Previous conversation summary: ${oldMessages.length} messages exchanged about various topics]`,
			timestamp: Date.now(),
		};

		const result: ConversationMessage[] = [];
		if (systemMessage) result.push(systemMessage);
		result.push(summaryMessage);
		result.push(...recentMessages);

		return result;
	}

	/**
	 * Get conversation statistics
	 */
	static getConversationStats(messages: ConversationMessage[]) {
		const estimateTokens = (msg: ConversationMessage) =>
			Math.ceil(msg.content.length / 4);
		const totalTokens = messages.reduce(
			(sum, msg) => sum + estimateTokens(msg),
			0,
		);

		return {
			messageCount: messages.length,
			estimatedTokens: totalTokens,
			withinStandardContext:
				totalTokens < this.DEFAULT_CONTEXT_WINDOW - this.RESERVE_TOKENS,
			percentOfContext:
				(totalTokens / (this.DEFAULT_CONTEXT_WINDOW - this.RESERVE_TOKENS)) *
				100,
		};
	}
}
