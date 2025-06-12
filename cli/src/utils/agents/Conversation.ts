import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { ConversationContext, ConversationMessage } from "./types";

export class Conversation {
	private context: ConversationContext;
	private participants: Set<string> = new Set(); // Track participant pubkeys

	constructor(id: string, agentName: string, systemPrompt?: string) {
		this.context = {
			id,
			agentName,
			messages: [],
			createdAt: Date.now(),
			lastActivityAt: Date.now(),
		};

		if (systemPrompt) {
			this.addMessage({
				role: "system",
				content: systemPrompt,
				timestamp: Date.now(),
			});
		}
	}

	getId(): string {
		return this.context.id;
	}

	getAgentName(): string {
		return this.context.agentName;
	}

	addMessage(message: ConversationMessage): void {
		this.context.messages.push(message);
		this.context.lastActivityAt = Date.now();
	}

	addUserMessage(content: string, event?: NDKEvent): void {
		this.addMessage({
			role: "user",
			content,
			event,
			timestamp: Date.now(),
		});

		// Track the author as a participant
		if (event?.author?.pubkey) {
			this.addParticipant(event.author.pubkey);
		}

		// Track any p-tagged pubkeys as participants
		if (event?.tags) {
			const pTags = event.tags.filter((tag) => tag[0] === "p");
			for (const pTag of pTags) {
				if (pTag[1]) {
					this.addParticipant(pTag[1]);
				}
			}
		}
	}

	addAssistantMessage(content: string): void {
		this.addMessage({
			role: "assistant",
			content,
			timestamp: Date.now(),
		});
	}

	getMessages(): ConversationMessage[] {
		return [...this.context.messages];
	}

	getMessageCount(): number {
		return this.context.messages.length;
	}

	getLastActivityTime(): number {
		return this.context.lastActivityAt;
	}

	getFormattedMessages(): Array<{ role: string; content: string }> {
		return this.context.messages.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}));
	}

	setMetadata(key: string, value: any): void {
		if (!this.context.metadata) {
			this.context.metadata = {};
		}
		this.context.metadata[key] = value;
	}

	getMetadata(key: string): any {
		return this.context.metadata?.[key];
	}

	getAllMetadata(): Record<string, any> | undefined {
		return this.context.metadata;
	}

	addParticipant(pubkey: string): void {
		this.participants.add(pubkey);
	}

	getParticipants(): string[] {
		return Array.from(this.participants);
	}

	isParticipant(pubkey: string): boolean {
		return this.participants.has(pubkey);
	}

	getParticipantCount(): number {
		return this.participants.size;
	}

	toJSON(): ConversationContext {
		// Create a deep copy and convert NDKEvents to raw events
		const serializable: ConversationContext = {
			...this.context,
			messages: this.context.messages.map((msg) => ({
				...msg,
				event: msg.event
					? // Check if it's an NDKEvent instance with rawEvent method
						typeof (msg.event as any).rawEvent === "function"
						? (msg.event as any).rawEvent()
						: msg.event // Already a raw event object
					: undefined,
			})),
			metadata: {
				...this.context.metadata,
				participants: this.getParticipants(),
			},
		};
		return serializable;
	}

	static fromJSON(data: ConversationContext): Conversation {
		const conversation = new Conversation(data.id, data.agentName);
		conversation.context = data;

		// Restore participants from metadata
		const participants = data.metadata?.participants;
		if (Array.isArray(participants)) {
			for (const pubkey of participants) {
				conversation.addParticipant(pubkey);
			}
		}

		return conversation;
	}
}
