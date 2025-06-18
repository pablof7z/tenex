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
    this.basePath = path.join(projectPath, ".tenex", "conversations");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async saveTeam(rootEventId: string, team: Team): Promise<void> {
    try {
      const teamPath = path.join(this.basePath, `${rootEventId}-team.json`);
      await fs.writeFile(teamPath, JSON.stringify(team, null, 2), "utf-8");
    } catch (error) {
      throw new ConversationError(`Failed to save team for conversation ${rootEventId}`, {
        rootEventId,
        error,
      });
    }
  }

  async getTeam(rootEventId: string): Promise<Team | null> {
    try {
      const teamPath = path.join(this.basePath, `${rootEventId}-team.json`);
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
      throw new ConversationError(`Failed to load team for conversation ${rootEventId}`, {
        rootEventId,
        error,
      });
    }
  }

  async appendMessage(rootEventId: string, message: ConversationMessage): Promise<void> {
    try {
      const messagesPath = path.join(this.basePath, `${rootEventId}-messages.jsonl`);
      const line = `${JSON.stringify(message)}\n`;
      await fs.appendFile(messagesPath, line, "utf-8");
    } catch (error) {
      throw new ConversationError(`Failed to append message to conversation ${rootEventId}`, {
        rootEventId,
        error,
      });
    }
  }

  async getMessages(rootEventId: string): Promise<ConversationMessage[]> {
    try {
      const messagesPath = path.join(this.basePath, `${rootEventId}-messages.jsonl`);
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
      throw new ConversationError(`Failed to load messages for conversation ${rootEventId}`, {
        rootEventId,
        error,
      });
    }
  }
}

// In-memory store for testing
export class InMemoryConversationStore implements IConversationStore {
  private teams = new Map<string, Team>();
  private messages = new Map<string, ConversationMessage[]>();

  async saveTeam(rootEventId: string, team: Team): Promise<void> {
    this.teams.set(rootEventId, team);
  }

  async getTeam(rootEventId: string): Promise<Team | null> {
    return this.teams.get(rootEventId) || null;
  }

  async appendMessage(rootEventId: string, message: ConversationMessage): Promise<void> {
    const messages = this.messages.get(rootEventId) || [];
    messages.push(message);
    this.messages.set(rootEventId, messages);
  }

  async getMessages(rootEventId: string): Promise<ConversationMessage[]> {
    return this.messages.get(rootEventId) || [];
  }
}
