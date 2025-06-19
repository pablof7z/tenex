/**
 * Event content types and validation
 */

// ============================================================================
// Backend Status Event Types
// ============================================================================

export interface BackendProject {
    readonly _brand: "BackendProject";
    name: string;
    title?: string;
    description?: string;
    naddr?: string;
    agentCount: number;
}

export interface BackendStatusContent {
    readonly _brand: "BackendStatusContent";
    hostname: string;
    projects: BackendProject[];
    timestamp?: number;
    status?: "online" | "offline";
}

export interface BackendInfo {
    readonly _brand: "BackendInfo";
    name: string;
    hostname: string;
    lastSeen: number;
    projects: BackendProject[];
}

// ============================================================================
// Task Content Types
// ============================================================================

export interface TaskContent {
    readonly _brand: "TaskContent";
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high";
    status?: "pending" | "in_progress" | "completed" | "blocked";
    assignee?: string;
    dueDate?: number;
    tags?: string[];
}

// ============================================================================
// Project Status Types
// ============================================================================

export interface ProjectStatusContent {
    readonly _brand: "ProjectStatusContent";
    status: "online" | "offline";
    timestamp: number;
    project: string;
    agentCount?: number;
    activeUsers?: string[];
}

// ============================================================================
// Agent Lesson Types
// ============================================================================

export interface AgentLessonContent {
    readonly _brand: "AgentLessonContent";
    lesson: string;
    context?: string;
    tags?: string[];
    agentId?: string;
    severity?: "low" | "medium" | "high";
}

// ============================================================================
// Nostr Tag Types
// ============================================================================

export type NostrTag = readonly [string, ...string[]];

export interface TaggedNostrTag<T extends string> extends ReadonlyArray<string> {
    readonly 0: T;
    readonly [index: number]: string;
}

// Common tag types
export type PubkeyTag = TaggedNostrTag<"p">;
export type EventTag = TaggedNostrTag<"e">;
export type AddressTag = TaggedNostrTag<"a">;
export type TopicTag = TaggedNostrTag<"t">;
export type IdentifierTag = TaggedNostrTag<"d">;

// ============================================================================
// Type Guards
// ============================================================================

export const isBackendProject = (obj: unknown): obj is BackendProject =>
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    typeof obj.name === "string" &&
    "agentCount" in obj &&
    typeof obj.agentCount === "number";

export const isBackendStatusContent = (obj: unknown): obj is BackendStatusContent =>
    typeof obj === "object" &&
    obj !== null &&
    "hostname" in obj &&
    typeof obj.hostname === "string" &&
    "projects" in obj &&
    Array.isArray(obj.projects) &&
    obj.projects.every(isBackendProject);

export const isTaskContent = (obj: unknown): obj is TaskContent =>
    typeof obj === "object" && obj !== null && "title" in obj && typeof obj.title === "string";

export const isProjectStatusContent = (obj: unknown): obj is ProjectStatusContent =>
    typeof obj === "object" &&
    obj !== null &&
    "status" in obj &&
    (obj.status === "online" || obj.status === "offline") &&
    "timestamp" in obj &&
    typeof obj.timestamp === "number" &&
    "project" in obj &&
    typeof obj.project === "string";

export const isAgentLessonContent = (obj: unknown): obj is AgentLessonContent =>
    typeof obj === "object" && obj !== null && "lesson" in obj && typeof obj.lesson === "string";

export const isValidNostrTag = (tag: unknown): tag is NostrTag =>
    Array.isArray(tag) && tag.length >= 1 && typeof tag[0] === "string";

// Tag type guards
export const isPubkeyTag = (tag: readonly string[]): tag is PubkeyTag =>
    tag.length >= 2 && tag[0] === "p";

export const isEventTag = (tag: readonly string[]): tag is EventTag =>
    tag.length >= 2 && tag[0] === "e";

export const isAddressTag = (tag: readonly string[]): tag is AddressTag =>
    tag.length >= 2 && tag[0] === "a";

export const isTopicTag = (tag: readonly string[]): tag is TopicTag =>
    tag.length >= 2 && tag[0] === "t";

export const isIdentifierTag = (tag: readonly string[]): tag is IdentifierTag =>
    tag.length >= 2 && tag[0] === "d";

// ============================================================================
// Factory Functions
// ============================================================================

export function createBackendProject(input: {
    name: string;
    title?: string;
    description?: string;
    naddr?: string;
    agentCount: number;
}): BackendProject {
    return {
        _brand: "BackendProject",
        name: input.name,
        title: input.title,
        description: input.description,
        naddr: input.naddr,
        agentCount: input.agentCount,
    };
}

export function createBackendStatusContent(input: {
    hostname: string;
    projects: BackendProject[];
    timestamp?: number;
    status?: "online" | "offline";
}): BackendStatusContent {
    return {
        _brand: "BackendStatusContent",
        hostname: input.hostname,
        projects: input.projects,
        timestamp: input.timestamp,
        status: input.status,
    };
}

export function createBackendInfo(input: {
    name: string;
    hostname: string;
    lastSeen: number;
    projects: BackendProject[];
}): BackendInfo {
    return {
        _brand: "BackendInfo",
        name: input.name,
        hostname: input.hostname,
        lastSeen: input.lastSeen,
        projects: input.projects,
    };
}

// ============================================================================
// Safe JSON Parsing
// ============================================================================

export function safeJsonParse<T>(content: string, validator: (obj: unknown) => obj is T): T | null {
    try {
        const parsed = JSON.parse(content);
        return validator(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function parseBackendStatusEvent(content: string): BackendStatusContent | null {
    return safeJsonParse(content, isBackendStatusContent);
}

export function parseTaskEvent(content: string): TaskContent | null {
    return safeJsonParse(content, isTaskContent);
}

export function parseProjectStatusEvent(content: string): ProjectStatusContent | null {
    return safeJsonParse(content, isProjectStatusContent);
}

export function parseAgentLessonEvent(content: string): AgentLessonContent | null {
    return safeJsonParse(content, isAgentLessonContent);
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Legacy backend project interface
 */
interface LegacyBackendProject {
    name?: string;
    title?: string;
    description?: string;
    naddr?: string;
    agentCount?: number;
}

/**
 * Legacy backend status interface
 */
interface LegacyBackendStatus {
    hostname?: string;
    projects?: LegacyBackendProject[];
    timestamp?: number;
    status?: string;
}

/**
 * Type guard for legacy backend status
 */
function isLegacyBackendStatus(obj: unknown): obj is LegacyBackendStatus {
    return typeof obj === "object" && obj !== null;
}

export function migrateBackendStatus(parsed: unknown): BackendStatusContent | null {
    if (!isLegacyBackendStatus(parsed)) {
        return null;
    }

    try {
        const projects = Array.isArray(parsed.projects)
            ? parsed.projects.map((p: LegacyBackendProject) =>
                  createBackendProject({
                      name: p.name || "Unknown",
                      title: p.title,
                      description: p.description,
                      naddr: p.naddr,
                      agentCount: typeof p.agentCount === "number" ? p.agentCount : 0,
                  })
              )
            : [];

        return createBackendStatusContent({
            hostname: parsed.hostname || "Unknown",
            projects,
            timestamp: parsed.timestamp,
            status: parsed.status === "offline" ? "offline" : "online",
        });
    } catch {
        return null;
    }
}
