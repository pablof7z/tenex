import { PromptBuilder } from "@/prompts/core/PromptBuilder";
import { fragmentRegistry } from "@/prompts/core/FragmentRegistry";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import type { Conversation } from "@/conversations/types";
import { NDKEvent } from "@nostr-dev-kit/ndk";

// Import fragments to register them
import "../agentFragments";

describe("Agent Execution Prompt Fragments", () => {
    describe("agentSystemPromptFragment", () => {
        it("should generate correct system prompt", () => {
            const mockAgent: Agent = {
                name: "TestAgent",
                role: "Developer",
                instructions: "Test instructions",
                tools: ["file", "shell"],
                pubkey: "test-pubkey",
                signer: {} as any,
                llmConfig: "test-config",
                slug: "test-agent",
            };

            const prompt = new PromptBuilder()
                .add("agent-system-prompt", {
                    agent: mockAgent,
                    phase: "chat" as Phase,
                    projectTitle: "Test Project",
                    projectRepository: "https://github.com/test/repo",
                })
                .build();

            expect(prompt).toContain("You are TestAgent, a Developer");
            expect(prompt).toContain("Test instructions");
            expect(prompt).toContain("Current Phase: CHAT");
            expect(prompt).toContain("Project: Test Project");
            expect(prompt).toContain("Repository: https://github.com/test/repo");
            expect(prompt).toContain("Available Tools");
            expect(prompt).toContain("file, shell");
        });
    });

    describe("conversationHistoryFragment", () => {
        it("should format conversation history correctly", () => {
            const mockHistory: Conversation["history"] = [
                {
                    id: "event1",
                    content: "Hello from user",
                    created_at: 1000,
                    tags: [["p", "user-pubkey"]],
                    pubkey: "user-pubkey",
                    kind: 1,
                    sig: "sig1",
                } as NDKEvent,
                {
                    id: "event2",
                    content: "Response from agent",
                    created_at: 2000,
                    tags: [["p", "agent-pubkey"]],
                    pubkey: "agent-pubkey",
                    kind: 1,
                    sig: "sig2",
                } as NDKEvent,
            ];

            const prompt = new PromptBuilder()
                .add("conversation-history", {
                    history: mockHistory,
                    maxMessages: 5,
                })
                .build();

            expect(prompt).toContain("Conversation History (Last 2 messages)");
            expect(prompt).toContain("user-pubkey: Hello from user");
            expect(prompt).toContain("agent-pubkey: Response from agent");
        });
    });

    describe("phaseContextFragment", () => {
        it("should generate correct phase context for each phase", () => {
            const phases: Phase[] = ["chat", "plan", "execute", "review"];

            phases.forEach((phase) => {
                const prompt = new PromptBuilder()
                    .add("phase-context", {
                        phase,
                    })
                    .build();

                expect(prompt).toContain("You are in the");
                expect(prompt).toContain("Focus on:");
            });
        });
    });

    describe("integrated prompt building", () => {
        it("should build complete agent prompt using multiple fragments", () => {
            const mockAgent: Agent = {
                name: "IntegratedAgent",
                role: "Full Stack Developer",
                instructions: "Build amazing applications",
                tools: ["claude_code"],
                pubkey: "test-pubkey",
                signer: {} as any,
                llmConfig: "test-config",
                slug: "integrated-agent",
            };

            const mockHistory: Conversation["history"] = [
                {
                    id: "event1",
                    content: "Build a new feature",
                    created_at: 1000,
                    tags: [["p", "user"]],
                    pubkey: "user",
                    kind: 1,
                    sig: "sig1",
                } as NDKEvent,
            ];

            const systemPrompt = new PromptBuilder()
                .add("agent-system-prompt", {
                    agent: mockAgent,
                    phase: "execute" as Phase,
                    projectTitle: "My App",
                })
                .build();

            const conversationHistory = new PromptBuilder()
                .add("conversation-history", {
                    history: mockHistory,
                })
                .build();

            const phaseContext = new PromptBuilder()
                .add("phase-context", {
                    phase: "execute" as Phase,
                })
                .build();

            const fullPrompt = new PromptBuilder()
                .add("full-prompt", {
                    conversationContent: conversationHistory,
                    phaseContext: phaseContext,
                    constraints: ["Write clean code", "Add tests"],
                })
                .build();

            // Verify all components are present
            expect(systemPrompt).toContain("You are IntegratedAgent");
            expect(systemPrompt).toContain("Full Stack Developer");
            expect(systemPrompt).toContain("Current Phase: EXECUTE");

            expect(conversationHistory).toContain("Build a new feature");

            expect(phaseContext).toContain("execution phase");
            expect(phaseContext).toContain("Implementing the planned features");

            expect(fullPrompt).toContain(conversationHistory);
            expect(fullPrompt).toContain(phaseContext);
            expect(fullPrompt).toContain("Write clean code");
            expect(fullPrompt).toContain("Add tests");
        });
    });
});
