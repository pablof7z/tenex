import fs from "node:fs/promises";
import path from "node:path";
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
		// Use agent-specific file names to avoid conflicts
		const fileName = `${data.agentName}-${data.id}.json`;
		const filePath = path.join(this.storageDir, fileName);

		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
		logger.info(`Saved conversation ${data.id} for agent ${data.agentName} to ${filePath}`);
	}

	async loadConversation(
		conversationId: string,
		agentName?: string,
	): Promise<ConversationContext | null> {
		// If agentName is provided, look for agent-specific file first
		if (agentName) {
			const agentFileName = `${agentName}-${conversationId}.json`;
			const agentFilePath = path.join(this.storageDir, agentFileName);
			
			try {
				const data = await fs.readFile(agentFilePath, "utf-8");
				return JSON.parse(data);
			} catch (error) {
				// Fall through to legacy file name
			}
		}
		
		// Legacy support: try loading without agent prefix
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
			const conversationIds = new Set<string>();
			
			for (const file of files) {
				if (file.endsWith(".json") && file !== "processed-events.json") {
					// Handle both old format (conversationId.json) and new format (agentName-conversationId.json)
					const parts = file.replace(".json", "").split("-");
					if (parts.length > 1) {
						// New format: skip agent name and join the rest
						conversationIds.add(parts.slice(1).join("-"));
					} else {
						// Old format
						conversationIds.add(parts[0]);
					}
				}
			}
			
			return Array.from(conversationIds);
		} catch (error) {
			return [];
		}
	}

	async deleteConversation(conversationId: string, agentName?: string): Promise<void> {
		// Try to delete agent-specific file first if agentName provided
		if (agentName) {
			const agentFileName = `${agentName}-${conversationId}.json`;
			const agentFilePath = path.join(this.storageDir, agentFileName);
			
			try {
				await fs.unlink(agentFilePath);
				logger.info(`Deleted conversation ${conversationId} for agent ${agentName}`);
				return;
			} catch (error) {
				// Fall through to try legacy file name
			}
		}
		
		// Try legacy file name
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
		
		try {
			const files = await fs.readdir(this.storageDir);
			
			for (const file of files) {
				if (file.endsWith(".json") && file !== "processed-events.json") {
					const filePath = path.join(this.storageDir, file);
					
					try {
						const data = await fs.readFile(filePath, "utf-8");
						const conversation: ConversationContext = JSON.parse(data);
						
						if (conversation.lastActivityAt && now - conversation.lastActivityAt > maxAgeMs) {
							await fs.unlink(filePath);
							logger.info(`Deleted old conversation file: ${file}`);
						}
					} catch (error) {
						logger.warn(`Failed to process conversation file ${file}: ${error}`);
					}
				}
			}
		} catch (error) {
			logger.warn(`Failed to cleanup old conversations: ${error}`);
		}
	}
}
