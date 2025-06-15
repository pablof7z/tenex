import { beforeEach, describe, expect, mock, test } from "bun:test";
import { type NDK, NDKEvent, type NDKKind } from "@nostr-dev-kit/ndk";
import type { Agent } from "../../Agent";
import { findAgentTool } from "../findAgent";
import type { ToolContext } from "../types";

describe("findAgentTool", () => {
    let mockContext: ToolContext;

    beforeEach(() => {
        mockContext = {
            agent: {
                getName: () => "default",
            } as unknown as Agent,
            ndk: {
                fetchEvents: mock(() => Promise.resolve(new Set())),
            } as unknown as NDK,
            agentName: "default",
            projectName: "test-project",
        } as ToolContext;
    });

    describe("tool definition", () => {
        test("should have correct name and description", () => {
            expect(findAgentTool.name).toBe("find_agent");
            expect(findAgentTool.description).toContain("Search for specialized AI agents");
        });

        test("should have correct parameters", () => {
            expect(findAgentTool.parameters).toHaveLength(4);

            const paramNames = findAgentTool.parameters.map((p) => p.name);
            expect(paramNames).toContain("capabilities");
            expect(paramNames).toContain("specialization");
            expect(paramNames).toContain("keywords");
            expect(paramNames).toContain("limit");
        });
    });

    describe("execute", () => {
        test("should reject non-default agents", async () => {
            const nonDefaultContext = {
                ...mockContext,
                agent: {
                    getName: () => "code",
                } as unknown as Agent,
                agentName: "code",
            };

            const result = await findAgentTool.execute({}, nonDefaultContext);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Only the default agent");
            expect(result.renderInChat.data.message).toContain("Only the default agent");
        });

        test("should require NDK context", async () => {
            const contextWithoutNDK = { ...mockContext, ndk: undefined };

            const result = await findAgentTool.execute({}, contextWithoutNDK);

            expect(result.success).toBe(false);
            expect(result.error).toContain("NDK client not available");
        });

        test("should search for agents with no criteria", async () => {
            const mockEvents = new Set([
                createMockNDKAgent(
                    "test-agent",
                    "A test agent",
                    "Testing role",
                    "Test instructions"
                ),
                createMockNDKAgent(
                    "another-agent",
                    "Another agent",
                    "Another role",
                    "More instructions"
                ),
            ]);

            mockContext.ndk.fetchEvents = mock(() => Promise.resolve(mockEvents));

            const result = await findAgentTool.execute({}, mockContext);

            expect(result.success).toBe(true);
            expect(result.candidates).toHaveLength(2);
            expect(result.renderInChat.type).toBe("agent_discovery");
            expect(result.renderInChat.data.agentEventIds).toHaveLength(2);
        });

        test("should filter agents by capabilities", async () => {
            const mockEvents = new Set([
                createMockNDKAgent(
                    "architect",
                    "Architecture expert",
                    "System design",
                    "Designs scalable systems"
                ),
                createMockNDKAgent("coder", "Code writer", "Implementation", "Writes clean code"),
                createMockNDKAgent(
                    "designer",
                    "UI/UX designer",
                    "Visual design",
                    "Creates beautiful interfaces"
                ),
            ]);

            mockContext.ndk.fetchEvents = mock(() => Promise.resolve(mockEvents));

            const result = await findAgentTool.execute(
                { capabilities: "architecture design" },
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.candidates.length).toBeGreaterThan(0);

            // Should rank architect and designer higher due to matching keywords
            const agentNames = result.candidates.map((c) => c.name);
            expect(agentNames).toContain("architect");
            expect(agentNames).toContain("designer");
        });

        test("should respect limit parameter", async () => {
            const mockEvents = new Set([
                createMockNDKAgent("agent1", "Agent 1", "Role 1", "Instructions 1"),
                createMockNDKAgent("agent2", "Agent 2", "Role 2", "Instructions 2"),
                createMockNDKAgent("agent3", "Agent 3", "Role 3", "Instructions 3"),
                createMockNDKAgent("agent4", "Agent 4", "Role 4", "Instructions 4"),
                createMockNDKAgent("agent5", "Agent 5", "Role 5", "Instructions 5"),
                createMockNDKAgent("agent6", "Agent 6", "Role 6", "Instructions 6"),
            ]);

            mockContext.ndk.fetchEvents = mock(() => Promise.resolve(mockEvents));

            const result = await findAgentTool.execute({ limit: 3 }, mockContext);

            expect(result.success).toBe(true);
            expect(result.candidates).toHaveLength(3);
        });

        test("should handle events with missing data gracefully", async () => {
            const mockEvents = new Set([
                createMockNDKAgent("complete", "Complete agent", "Role", "Instructions"),
                createMockNDKAgent("", "Missing name", "Role", "Instructions"), // Missing name
                createMockNDKAgent("no-desc", "", "Role", "Instructions"), // Missing description
            ]);

            mockContext.ndk.fetchEvents = mock(() => Promise.resolve(mockEvents));

            const result = await findAgentTool.execute({}, mockContext);

            expect(result.success).toBe(true);
            // Should only include the complete agent
            expect(result.candidates).toHaveLength(1);
            expect(result.candidates[0].name).toBe("complete");
        });

        test("should include proper renderInChat structure", async () => {
            const mockEvents = new Set([
                createMockNDKAgent("test-agent", "Test agent", "Testing", "Test everything"),
            ]);

            mockContext.ndk.fetchEvents = mock(() => Promise.resolve(mockEvents));

            const result = await findAgentTool.execute({ capabilities: "testing" }, mockContext);

            expect(result.success).toBe(true);
            expect(result.renderInChat).toBeDefined();
            expect(result.renderInChat.type).toBe("agent_discovery");
            expect(result.renderInChat.data).toHaveProperty("query");
            expect(result.renderInChat.data).toHaveProperty("agentEventIds");
            expect(result.renderInChat.data).toHaveProperty("message");
            expect(result.renderInChat.data.message).toContain(
                "Found 1 agent that may help with testing"
            );
            expect(result.renderInChat.data.agentEventIds).toHaveLength(1);
            expect(result.renderInChat.data.agentEventIds[0]).toBe("event-test-agent");
        });

        test("should handle fetch errors gracefully", async () => {
            mockContext.ndk.fetchEvents = mock(() => Promise.reject(new Error("Network error")));

            const result = await findAgentTool.execute({}, mockContext);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Network error");
            expect(result.renderInChat.data.message).toContain("Error searching for agents");
        });
    });
});

// Helper function to create mock NDKAgent events
function createMockNDKAgent(
    name: string,
    description: string,
    role: string,
    instructions: string
): NDKEvent {
    const event = new NDKEvent();
    event.kind = 4199 as NDKKind;
    event.id = `event-${name}`;
    event.pubkey = `pubkey-${name}`;
    event.created_at = Date.now() / 1000;
    event.tags = [
        ["title", name],
        ["description", description],
        ["role", role],
        ["instructions", instructions],
        ["version", "1"],
    ];

    // Mock the tagValue method
    event.tagValue = (tagName: string) => {
        const tag = event.tags.find((t) => t[0] === tagName);
        return tag ? tag[1] : undefined;
    };

    return event;
}
