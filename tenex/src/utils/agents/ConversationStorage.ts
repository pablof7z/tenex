import path from "node:path";
import * as fileSystem from "@tenex/shared/fs";
import { logger } from "@tenex/shared/node";
import type { ConversationContext } from "./types";

export class ConversationStorage {
    private storageDir: string;
    private processedEventsFile: string;
    private processedEvents: Map<string, number>; // eventId -> timestamp

    constructor(projectPath: string) {
        this.storageDir = path.join(projectPath, ".tenex", "conversations");
        this.processedEventsFile = path.join(this.storageDir, "processed-events.json");
        this.processedEvents = new Map();
    }

    async initialize(): Promise<void> {
        // Ensure storage directory exists
        await fileSystem.ensureDirectory(this.storageDir);

        // Load processed events
        await this.loadProcessedEvents();
    }

    private async loadProcessedEvents(): Promise<void> {
        try {
            const events = await fileSystem.readJsonFile(this.processedEventsFile);
            this.processedEvents = new Map(Object.entries(events));
            logger.info(`Loaded ${this.processedEvents.size} processed events`);
        } catch (_error) {
            // File doesn't exist yet, start fresh
            logger.info("No processed events file found, starting fresh");
        }
    }

    async saveProcessedEvents(): Promise<void> {
        const data = Object.fromEntries(this.processedEvents);
        await fileSystem.writeJsonFile(this.processedEventsFile, data, { spaces: 2 });
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
        conversation: ConversationContext | { toJSON(): ConversationContext }
    ): Promise<void> {
        // Handle both raw ConversationContext and Conversation instances
        const data = "toJSON" in conversation ? conversation.toJSON() : conversation;
        // Use agent-specific file names to avoid conflicts
        const fileName = `${data.agentName}-${data.id}.json`;
        const filePath = path.join(this.storageDir, fileName);

        await fileSystem.writeJsonFile(filePath, data, { spaces: 2 });
        logger.info(`Saved conversation ${data.id} for agent ${data.agentName} to ${filePath}`);
    }

    async loadConversation(
        conversationId: string,
        agentName: string
    ): Promise<ConversationContext | null> {
        const fileName = `${agentName}-${conversationId}.json`;
        const filePath = path.join(this.storageDir, fileName);

        try {
            return await fileSystem.readJsonFile<ConversationContext>(filePath);
        } catch (_error) {
            return null;
        }
    }

    async listConversations(): Promise<string[]> {
        try {
            const files = await fileSystem.listDirectory(this.storageDir);
            const conversationIds = new Set<string>();

            for (const file of files) {
                if (file.endsWith(".json") && file !== "processed-events.json") {
                    const parts = file.replace(".json", "").split("-");
                    if (parts.length > 1) {
                        conversationIds.add(parts.slice(1).join("-"));
                    }
                }
            }

            return Array.from(conversationIds);
        } catch (_error) {
            return [];
        }
    }

    async deleteConversation(conversationId: string, agentName: string): Promise<void> {
        const fileName = `${agentName}-${conversationId}.json`;
        const filePath = path.join(this.storageDir, fileName);

        try {
            await fileSystem.deleteFile(filePath);
            logger.info(`Deleted conversation ${conversationId} for agent ${agentName}`);
        } catch (error) {
            logger.warn(`Failed to delete conversation ${conversationId}: ${error}`);
        }
    }

    async cleanupOldConversations(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
        const now = Date.now();

        try {
            const files = await fileSystem.listDirectory(this.storageDir);

            for (const file of files) {
                if (file.endsWith(".json") && file !== "processed-events.json") {
                    const filePath = path.join(this.storageDir, file);

                    try {
                        const conversation =
                            await fileSystem.readJsonFile<ConversationContext>(filePath);

                        if (
                            conversation.lastActivityAt &&
                            now - conversation.lastActivityAt > maxAgeMs
                        ) {
                            await fileSystem.deleteFile(filePath);
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
