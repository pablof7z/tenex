import { readSpecsTool } from "../readSpecs";
import type { ToolContext } from "../types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock NDK
const mockNDK = {
    fetchEvents: vi.fn(),
} as unknown as NDK;

// Mock agent
const mockAgent = {
    getPubkey: vi.fn().mockReturnValue("agent-pubkey"),
};

// Mock project event
const mockProjectEvent = {
    pubkey: "project-pubkey",
    dTag: "test-project",
} as any;

describe("readSpecsTool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return error when agent context is not available", async () => {
        const context: ToolContext = {
            ndk: mockNDK,
            projectEvent: mockProjectEvent,
        } as any;

        const result = await readSpecsTool.execute({}, context);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Agent context not available");
    });

    it("should return error when project event is not available", async () => {
        const context: ToolContext = {
            ndk: mockNDK,
            agent: mockAgent,
        } as any;

        const result = await readSpecsTool.execute({}, context);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Project event not available in context");
    });

    it("should fetch specs from project pubkey with correct filter", async () => {
        const context: ToolContext = {
            ndk: mockNDK,
            agent: mockAgent,
            projectEvent: mockProjectEvent,
        } as any;

        const mockEvents = new Set<NDKEvent>();
        mockNDK.fetchEvents = vi.fn().mockResolvedValue(mockEvents);

        await readSpecsTool.execute({}, context);

        expect(mockNDK.fetchEvents).toHaveBeenCalledWith({
            kinds: [30023],
            authors: ["project-pubkey"],
            "#a": ["31933:project-pubkey:test-project"],
        });
    });

    it("should add spec name filter when provided", async () => {
        const context: ToolContext = {
            ndk: mockNDK,
            agent: mockAgent,
            projectEvent: mockProjectEvent,
        } as any;

        const mockEvents = new Set<NDKEvent>();
        mockNDK.fetchEvents = vi.fn().mockResolvedValue(mockEvents);

        await readSpecsTool.execute({ spec_name: "architecture" }, context);

        expect(mockNDK.fetchEvents).toHaveBeenCalledWith({
            kinds: [30023],
            authors: ["project-pubkey"],
            "#a": ["31933:project-pubkey:test-project"],
            "#d": ["ARCHITECTURE"],
        });
    });

    it("should return formatted spec when found", async () => {
        const context: ToolContext = {
            ndk: mockNDK,
            agent: mockAgent,
            projectEvent: mockProjectEvent,
        } as any;

        const mockEvent = {
            created_at: 1234567890,
            id: "test-event-id",
            tags: [
                ["d", "SPEC"],
                ["summary", "Initial specification"],
            ],
            rawEvent: () => ({
                kind: 30023,
                content: "# Test Specification\n\nThis is a test spec.",
                tags: [["title", "Test Specification"]],
            }),
        } as any;

        const mockEvents = new Set([mockEvent]);
        mockNDK.fetchEvents = vi.fn().mockResolvedValue(mockEvents);

        const result = await readSpecsTool.execute({ spec_name: "spec" }, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain("Test Specification");
        expect(result.output).toContain("This is a test spec");
        expect(result.output).toContain("Initial specification");
    });

    it("should handle multiple specs correctly", async () => {
        const context: ToolContext = {
            ndk: mockNDK,
            agent: mockAgent,
            projectEvent: mockProjectEvent,
        } as any;

        const mockEvent1 = {
            created_at: 1234567890,
            id: "test-event-1",
            tags: [
                ["d", "SPEC"],
                ["summary", "Spec update"],
            ],
            rawEvent: () => ({
                kind: 30023,
                content: "# Spec Content",
                tags: [["title", "Main Specification"]],
            }),
        } as any;

        const mockEvent2 = {
            created_at: 1234567891,
            id: "test-event-2",
            tags: [
                ["d", "ARCHITECTURE"],
                ["summary", "Architecture doc"],
            ],
            rawEvent: () => ({
                kind: 30023,
                content: "# Architecture Content",
                tags: [["title", "Architecture Guide"]],
            }),
        } as any;

        const mockEvents = new Set([mockEvent1, mockEvent2]);
        mockNDK.fetchEvents = vi.fn().mockResolvedValue(mockEvents);

        const result = await readSpecsTool.execute({}, context);

        expect(result.success).toBe(true);
        expect(result.output).toContain("Found 2 specifications");
        expect(result.output).toContain("Main Specification");
        expect(result.output).toContain("Architecture Guide");
    });
});
