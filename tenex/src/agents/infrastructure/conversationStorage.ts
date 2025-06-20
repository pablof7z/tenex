import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ConversationError } from "../core/errors";
import type { ConversationMessage, Team } from "../core/types";

// In-memory storage for testing
let inMemoryMode = false;
const inMemoryTeams = new Map<string, Team>();
const inMemoryMessages = new Map<string, ConversationMessage[]>();

export function enableInMemoryMode(): void {
  inMemoryMode = true;
  inMemoryTeams.clear();
  inMemoryMessages.clear();
}

export function disableInMemoryMode(): void {
  inMemoryMode = false;
  inMemoryTeams.clear();
  inMemoryMessages.clear();
}

function getConversationPath(projectPath: string): string {
  return path.join(projectPath, ".tenex", "conversations");
}

export async function initializeConversationStorage(projectPath: string): Promise<void> {
  if (inMemoryMode) return;

  const basePath = getConversationPath(projectPath);
  await fs.mkdir(basePath, { recursive: true });
}

export async function saveTeam(
  projectPath: string,
  rootEventId: string,
  team: Team
): Promise<void> {
  if (inMemoryMode) {
    inMemoryTeams.set(rootEventId, team);
    return;
  }

  try {
    const basePath = getConversationPath(projectPath);
    const teamPath = path.join(basePath, `${rootEventId}-team.json`);
    await fs.writeFile(teamPath, JSON.stringify(team, null, 2), "utf-8");
  } catch (error) {
    throw new ConversationError(`Failed to save team for conversation ${rootEventId}`, {
      rootEventId,
      error,
    });
  }
}

export async function getTeam(projectPath: string, rootEventId: string): Promise<Team | null> {
  if (inMemoryMode) {
    return inMemoryTeams.get(rootEventId) || null;
  }

  try {
    const basePath = getConversationPath(projectPath);
    const teamPath = path.join(basePath, `${rootEventId}-team.json`);
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

export async function appendMessage(
  projectPath: string,
  rootEventId: string,
  message: ConversationMessage
): Promise<void> {
  if (inMemoryMode) {
    const messages = inMemoryMessages.get(rootEventId) || [];
    messages.push(message);
    inMemoryMessages.set(rootEventId, messages);
    return;
  }

  try {
    const basePath = getConversationPath(projectPath);
    const messagesPath = path.join(basePath, `${rootEventId}-messages.jsonl`);
    const line = `${JSON.stringify(message)}\n`;
    await fs.appendFile(messagesPath, line, "utf-8");
  } catch (error) {
    throw new ConversationError(`Failed to append message to conversation ${rootEventId}`, {
      rootEventId,
      error,
    });
  }
}

export async function getMessages(
  projectPath: string,
  rootEventId: string
): Promise<ConversationMessage[]> {
  if (inMemoryMode) {
    return inMemoryMessages.get(rootEventId) || [];
  }

  try {
    const basePath = getConversationPath(projectPath);
    const messagesPath = path.join(basePath, `${rootEventId}-messages.jsonl`);
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
