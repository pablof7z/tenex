import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ConversationError } from "../core/errors";
import type {
    ConversationMessage,
    ConversationStore as IConversationStore,
    Team,
} from "../core/types";

export class FileConversationStore implements IConversationStore {
    private basePath: string;

    constructor(projectPath: string) {
        this.basePath = path.join(projectPath, ".tenex", "conversations-v2");
    }

    async initialize(): Promise<void> {
        await fs.mkdir(this.basePath, { recursive: true });
    }

    async saveTeam(conversationId: string, team: Team): Promise<void> {
        try {
            const teamPath = path.join(this.basePath, `${conversationId}-team.json`);
            await fs.writeFile(teamPath, JSON.stringify(team, null, 2), "utf-8");
        } catch (error) {
            throw new ConversationError(`Failed to save team for conversation ${conversationId}`, {
                conversationId,
                error,
            });
        }
    }

    async getTeam(conversationId: string): Promise<Team | null> {
        try {
            const teamPath = path.join(this.basePath, `${conversationId}-team.json`);
            const data = await fs.readFile(teamPath, "utf-8");
            return JSON.parse(data);
        } catch (error) {
            if (
                error instanceof Error &&
                "code" in error &&
                (error as NodeJS.ErrnoException).code === "ENOENT"
            ) {
                return null;
            }
            throw new ConversationError(`Failed to load team for conversation ${conversationId}`, {
                conversationId,
                error,
            });
        }
    }

    async appendMessage(conversationId: string, message: ConversationMessage): Promise<void> {
        try {
            const messagesPath = path.join(this.basePath, `${conversationId}-messages.jsonl`);
            const line = `${JSON.stringify(message)}\n`;
            await fs.appendFile(messagesPath, line, "utf-8");
        } catch (error) {
            throw new ConversationError(
                `Failed to append message to conversation ${conversationId}`,
                { conversationId, error }
            );
        }
    }

    async getMessages(conversationId: string): Promise<ConversationMessage[]> {
        try {
            const messagesPath = path.join(this.basePath, `${conversationId}-messages.jsonl`);
            const data = await fs.readFile(messagesPath, "utf-8");

            return data
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => JSON.parse(line));
        } catch (error) {
            if (
                error instanceof Error &&
                "code" in error &&
                (error as NodeJS.ErrnoException).code === "ENOENT"
            ) {
                return [];
            }
            throw new ConversationError(
                `Failed to load messages for conversation ${conversationId}`,
                { conversationId, error }
            );
        }
    }
}

// In-memory store for testing
export class InMemoryConversationStore implements IConversationStore {
    private teams = new Map<string, Team>();
    private messages = new Map<string, ConversationMessage[]>();

    async saveTeam(conversationId: string, team: Team): Promise<void> {
        this.teams.set(conversationId, team);
    }

    async getTeam(conversationId: string): Promise<Team | null> {
        return this.teams.get(conversationId) || null;
    }

    async appendMessage(conversationId: string, message: ConversationMessage): Promise<void> {
        const messages = this.messages.get(conversationId) || [];
        messages.push(message);
        this.messages.set(conversationId, messages);
    }

    async getMessages(conversationId: string): Promise<ConversationMessage[]> {
        return this.messages.get(conversationId) || [];
    }
}
