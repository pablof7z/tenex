import { promises as fs } from "node:fs";
import path from "node:path";
import type { Phase } from "@/conversations/phases";
import { ensureDirectory, fileExists, readJsonFile, writeJsonFile } from "@/lib/fs";
import { getNDK } from "@/nostr/ndkClient";
import { logger } from "@/utils/logger";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { Message } from "multi-llm-ts";
import type { AgentContext, ConversationMetadata as ConvMetadata, Conversation } from "../types";
import {
    type AgentContextSchema,
    MetadataFileSchema,
    SerializedConversationSchema,
} from "./schemas";
import type { z } from "zod";
import type {
    ConversationMetadata,
    ConversationPersistenceAdapter,
    ConversationSearchCriteria,
} from "./types";

export class FileSystemAdapter implements ConversationPersistenceAdapter {
    private conversationsDir: string;
    private metadataPath: string;
    private archiveDir: string;
    private metadataLock: Promise<void> = Promise.resolve();

    constructor(projectPath: string) {
        this.conversationsDir = path.join(projectPath, ".tenex", "conversations");
        this.metadataPath = path.join(this.conversationsDir, "metadata.json");
        this.archiveDir = path.join(this.conversationsDir, "archive");
    }

    async initialize(): Promise<void> {
        await ensureDirectory(this.conversationsDir);
        await ensureDirectory(this.archiveDir);

        // Initialize metadata file if it doesn't exist
        if (!(await fileExists(this.metadataPath))) {
            await writeJsonFile(this.metadataPath, { conversations: [] });
        }
    }

    async save(conversation: Conversation): Promise<void> {
        try {
            const filePath = this.getConversationPath(conversation.id);

            // Convert agentContexts Map to a plain object for serialization
            const agentContextsObj: Record<string, z.infer<typeof AgentContextSchema>> = {};
            if (conversation.agentContexts) {
                for (const [key, context] of conversation.agentContexts.entries()) {
                    agentContextsObj[key] = {
                        agentSlug: context.agentSlug,
                        messages: context.messages.map((msg) => ({
                            role: msg.role,
                            content: msg.content,
                            reasoning: msg.reasoning,
                            attachments: msg.attachments,
                        })),
                        tokenCount: context.tokenCount,
                        lastUpdate:
                            context.lastUpdate instanceof Date
                                ? context.lastUpdate.toISOString()
                                : context.lastUpdate,
                        claudeSessionId: context.claudeSessionId,
                    };
                }
            }

            // Serialize NDKEvents to a storable format
            const serialized = {
                ...conversation,
                history: conversation.history.map((event) => event.serialize(true, true)),
                agentContexts: agentContextsObj,
            };

            await writeJsonFile(filePath, serialized);

            // Update metadata
            await this.updateMetadata(conversation);
        } catch (error) {
            logger.error("Failed to save conversation", { error, id: conversation.id });
            throw error;
        }
    }

    async load(conversationId: string): Promise<Conversation | null> {
        try {
            const filePath = this.getConversationPath(conversationId);

            if (!(await fileExists(filePath))) {
                // Check archive
                const archivePath = this.getArchivePath(conversationId);
                if (!(await fileExists(archivePath))) {
                    return null;
                }
            }

            const rawData = await readJsonFile(filePath);

            // Validate the loaded data with Zod
            const parseResult = SerializedConversationSchema.safeParse(rawData);
            if (!parseResult.success) {
                logger.error("Invalid conversation data", {
                    id: conversationId,
                    errors: parseResult.error.errors,
                });
                return null;
            }

            const data = parseResult.data;

            // Reconstruct conversation with validated data
            const ndk = getNDK();

            // Reconstruct agentContexts Map
            const agentContextsMap = new Map<string, AgentContext>();
            if (data.agentContexts) {
                for (const [agentSlug, contextData] of Object.entries(data.agentContexts)) {
                    const context: AgentContext = {
                        agentSlug: contextData.agentSlug,
                        messages: contextData.messages.map((msg) => {
                            const message = new Message(msg.role, msg.content || null);
                            if (msg.reasoning) message.reasoning = msg.reasoning;
                            if (msg.attachments) {
                                msg.attachments.forEach((att) => message.attach(att));
                            }
                            return message;
                        }),
                        tokenCount: contextData.tokenCount,
                        lastUpdate: new Date(contextData.lastUpdate),
                        claudeSessionId: contextData.claudeSessionId,
                    };
                    agentContextsMap.set(agentSlug, context);
                }
            }

            const conversation: Conversation = {
                id: data.id,
                title: data.title,
                phase: data.phase,
                history: data.history
                    .map((serializedEvent: string) => {
                        try {
                            return NDKEvent.deserialize(ndk, serializedEvent);
                        } catch (error) {
                            logger.error("Failed to deserialize event", { error, serializedEvent });
                            return null;
                        }
                    })
                    .filter((event): event is NDKEvent => event !== null),
                agentContexts: agentContextsMap,
                phaseStartedAt: data.phaseStartedAt,
                metadata: data.metadata,
                phaseTransitions: data.phaseTransitions,
                executionTime: data.executionTime || {
                    totalSeconds: 0,
                    isActive: false,
                    lastUpdated: Date.now(),
                },
            };

            return conversation;
        } catch (error) {
            logger.error("Failed to load conversation", { error, id: conversationId });
            return null;
        }
    }

    async delete(conversationId: string): Promise<void> {
        try {
            const filePath = this.getConversationPath(conversationId);

            if (await fileExists(filePath)) {
                await fs.unlink(filePath);
            }

            // Remove from metadata
            await this.removeFromMetadata(conversationId);

            logger.info("Conversation deleted", { id: conversationId });
        } catch (error) {
            logger.error("Failed to delete conversation", { error, id: conversationId });
            throw error;
        }
    }

    async list(): Promise<ConversationMetadata[]> {
        try {
            const metadata = await this.loadMetadata();
            return metadata.conversations;
        } catch (error) {
            logger.error("Failed to list conversations", { error });
            return [];
        }
    }

    async search(criteria: ConversationSearchCriteria): Promise<ConversationMetadata[]> {
        const allMetadata = await this.list();

        return allMetadata.filter((meta) => {
            if (
                criteria.title &&
                !meta.title.toLowerCase().includes(criteria.title.toLowerCase())
            ) {
                return false;
            }

            if (criteria.phase && meta.phase !== criteria.phase) {
                return false;
            }

            if (criteria.dateFrom && meta.createdAt < criteria.dateFrom) {
                return false;
            }

            if (criteria.dateTo && meta.createdAt > criteria.dateTo) {
                return false;
            }

            if (criteria.archived !== undefined && meta.archived !== criteria.archived) {
                return false;
            }

            return true;
        });
    }

    async archive(conversationId: string): Promise<void> {
        try {
            const sourcePath = this.getConversationPath(conversationId);
            const destPath = this.getArchivePath(conversationId);

            if (await fileExists(sourcePath)) {
                await fs.rename(sourcePath, destPath);
            }

            // Update metadata with lock
            this.metadataLock = this.metadataLock.then(async () => {
                try {
                    const metadata = await this.loadMetadata();
                    const conv = metadata.conversations.find((c) => c.id === conversationId);
                    if (conv) {
                        conv.archived = true;
                        await this.saveMetadata(metadata);
                    }
                } catch (error) {
                    logger.error("Failed to update metadata for archive", {
                        error,
                        conversationId,
                    });
                    throw error;
                }
            });

            await this.metadataLock;

            logger.info("Conversation archived", { id: conversationId });
        } catch (error) {
            logger.error("Failed to archive conversation", { error, id: conversationId });
            throw error;
        }
    }

    async restore(conversationId: string): Promise<void> {
        try {
            const sourcePath = this.getArchivePath(conversationId);
            const destPath = this.getConversationPath(conversationId);

            if (await fileExists(sourcePath)) {
                await fs.rename(sourcePath, destPath);
            }

            // Update metadata with lock
            this.metadataLock = this.metadataLock.then(async () => {
                try {
                    const metadata = await this.loadMetadata();
                    const conv = metadata.conversations.find((c) => c.id === conversationId);
                    if (conv) {
                        conv.archived = false;
                        await this.saveMetadata(metadata);
                    }
                } catch (error) {
                    logger.error("Failed to update metadata for restore", {
                        error,
                        conversationId,
                    });
                    throw error;
                }
            });

            await this.metadataLock;

            logger.info("Conversation restored", { id: conversationId });
        } catch (error) {
            logger.error("Failed to restore conversation", { error, id: conversationId });
            throw error;
        }
    }

    private getConversationPath(conversationId: string): string {
        return path.join(this.conversationsDir, `${conversationId}.json`);
    }

    private getArchivePath(conversationId: string): string {
        return path.join(this.archiveDir, `${conversationId}.json`);
    }

    private async loadMetadata(): Promise<{ conversations: ConversationMetadata[] }> {
        try {
            const rawData = await readJsonFile(this.metadataPath);

            // Validate with Zod
            const parseResult = MetadataFileSchema.safeParse(rawData);
            if (!parseResult.success) {
                logger.error("Invalid metadata file structure", {
                    errors: parseResult.error.errors,
                });
                return { conversations: [] };
            }

            return parseResult.data;
        } catch {
            return { conversations: [] };
        }
    }

    private async saveMetadata(metadata: { conversations: ConversationMetadata[] }): Promise<void> {
        await writeJsonFile(this.metadataPath, metadata);
    }

    private async updateMetadata(conversation: Conversation): Promise<void> {
        // Serialize metadata updates to prevent race conditions
        this.metadataLock = this.metadataLock.then(async () => {
            try {
                const metadata = await this.loadMetadata();

                const existing = metadata.conversations.findIndex((c) => c.id === conversation.id);
                const meta: ConversationMetadata = {
                    id: conversation.id,
                    title: conversation.title,
                    createdAt: conversation.history[0]?.created_at || Date.now() / 1000,
                    updatedAt: Date.now() / 1000,
                    phase: conversation.phase,
                    eventCount: conversation.history.length,
                    agentCount: new Set(conversation.history.map((e) => e.pubkey)).size,
                    archived: false,
                };

                if (existing >= 0) {
                    metadata.conversations[existing] = meta;
                } else {
                    metadata.conversations.push(meta);
                }

                await this.saveMetadata(metadata);
            } catch (error) {
                logger.error("Failed to update metadata", {
                    error,
                    conversationId: conversation.id,
                });
                throw error;
            }
        });

        await this.metadataLock;
    }

    private async removeFromMetadata(conversationId: string): Promise<void> {
        // Serialize metadata updates to prevent race conditions
        this.metadataLock = this.metadataLock.then(async () => {
            try {
                const metadata = await this.loadMetadata();
                metadata.conversations = metadata.conversations.filter(
                    (c) => c.id !== conversationId
                );
                await this.saveMetadata(metadata);
            } catch (error) {
                logger.error("Failed to remove from metadata", { error, conversationId });
                throw error;
            }
        });

        await this.metadataLock;
    }
}
