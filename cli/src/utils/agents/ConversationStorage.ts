import path from "path";
import fs from "fs/promises";
import { logger } from "../logger";
import type { ConversationContext } from "./types";

export class ConversationStorage {
	private storageDir: string;
	private processedEventsFile: string;
	private processedEvents: Map<string, number>; // eventId -> timestamp

	constructor(projectPath: string) {
		this.storageDir = path.join(projectPath, ".tenex", "conversations");
		this.processedEventsFile = path.join(
			this.storageDir,
			"processed-events.json",
		);
		this.processedEvents = new Map();
	}

	async initialize(): Promise<void> {
		// Ensure storage directory exists
		await fs.mkdir(this.storageDir, { recursive: true });

		// Load processed events
		await this.loadProcessedEvents();
	}

	private async loadProcessedEvents(): Promise<void> {
		try {
			const data = await fs.readFile(this.processedEventsFile, "utf-8");
			const events = JSON.parse(data);
			this.processedEvents = new Map(Object.entries(events));
			logger.info(`Loaded ${this.processedEvents.size} processed events`);
		} catch (error) {
			// File doesn't exist yet, start fresh
			logger.info("No processed events file found, starting fresh");
		}
	}

	async saveProcessedEvents(): Promise<void> {
		const data = Object.fromEntries(this.processedEvents);
		await fs.writeFile(this.processedEventsFile, JSON.stringify(data, null, 2));
	}

	async markEventProcessed(eventId: string, timestamp: number): Promise<void> {
		this.processedEvents.set(eventId, timestamp);
		await this.saveProcessedEvents();
	}

	isEventProcessed(eventId: string): boolean {
		return this.processedEvents.has(eventId);
	}

	getProcessedEventTimestamp(eventId: string): number | undefined {
		return this.processedEvents.get(eventId);
	}

	async saveConversation(
		conversation: ConversationContext | { toJSON(): ConversationContext },
	): Promise<void> {
		// Handle both raw ConversationContext and Conversation instances
		const data =
			"toJSON" in conversation ? conversation.toJSON() : conversation;
		const fileName = `${data.id}.json`;
		const filePath = path.join(this.storageDir, fileName);

		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
		logger.info(`Saved conversation ${data.id} to ${filePath}`);
	}

	async loadConversation(
		conversationId: string,
	): Promise<ConversationContext | null> {
		const fileName = `${conversationId}.json`;
		const filePath = path.join(this.storageDir, fileName);

		try {
			const data = await fs.readFile(filePath, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			return null;
		}
	}

	async listConversations(): Promise<string[]> {
		try {
			const files = await fs.readdir(this.storageDir);
			return files
				.filter((f) => f.endsWith(".json") && f !== "processed-events.json")
				.map((f) => f.replace(".json", ""));
		} catch (error) {
			return [];
		}
	}

	async deleteConversation(conversationId: string): Promise<void> {
		const fileName = `${conversationId}.json`;
		const filePath = path.join(this.storageDir, fileName);

		try {
			await fs.unlink(filePath);
			logger.info(`Deleted conversation ${conversationId}`);
		} catch (error) {
			logger.warn(`Failed to delete conversation ${conversationId}: ${error}`);
		}
	}

	async cleanupOldConversations(
		maxAgeMs: number = 30 * 24 * 60 * 60 * 1000,
	): Promise<void> {
		const now = Date.now();
		const conversations = await this.listConversations();

		for (const id of conversations) {
			const conversation = await this.loadConversation(id);
			if (conversation && now - conversation.lastActivityAt > maxAgeMs) {
				await this.deleteConversation(id);
			}
		}
	}
}
