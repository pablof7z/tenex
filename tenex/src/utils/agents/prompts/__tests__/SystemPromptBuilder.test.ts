import { beforeEach, describe, expect, it } from "bun:test";
import { SystemPromptBuilder } from "../SystemPromptBuilder";
import type { PromptSectionBuilder, SystemPromptContext } from "../types";

describe("SystemPromptBuilder", () => {
    let builder: SystemPromptBuilder;
    let mockContext: SystemPromptContext;

    beforeEach(() => {
        builder = new SystemPromptBuilder();
        mockContext = {
            agentName: "test-agent",
            agentConfig: {
                name: "test-agent",
                description: "A test agent for unit testing",
                role: "Test Specialist",
                instructions: "Follow test protocols",
                provider: "anthropic",
                model: "claude-3-opus",
            },
            projectInfo: {
                id: "test-project",
                naddr: "naddr1test",
                title: "Test Project",
                description: "A test project",
                repository: "https://github.com/test/project",
                hashtags: ["typescript", "testing"],
                metadata: {
                    title: "Test Project",
                    naddr: "naddr1test",
                },
            },
            otherAgents: [
                { name: "code-agent", description: "Writes code", role: "Developer" },
                { name: "review-agent", description: "Reviews code", role: "Reviewer" },
            ],
            projectRules: [
                {
                    id: "rule1",
                    eventId: "event1",
                    title: "Code Style",
                    description: "Follow TypeScript best practices",
                    content: "Use strict mode and proper typing",
                    fetchedAt: Date.now(),
                },
            ],
            additionalRules: "Always write tests",
        };
    });

    describe("basic functionality", () => {
        it("should build a complete system prompt with all sections", () => {
            const prompt = builder.build(mockContext);

            expect(prompt).toContain("## TENEX System Instructions");
            expect(prompt).toContain("## Your Identity");
            expect(prompt).toContain("You are Test Specialist");
            expect(prompt).toContain("## Project Context");
            expect(prompt).toContain("Test Project");
            expect(prompt).toContain("## Available Agents in the System");
            expect(prompt).toContain("code-agent");
            expect(prompt).toContain("## Project Rules");
            expect(prompt).toContain("Code Style");
            expect(prompt).toContain("Always write tests");
        });

        it("should handle missing optional context", () => {
            const minimalContext: SystemPromptContext = {
                agentName: "minimal-agent",
                agentConfig: {
                    name: "minimal-agent",
                },
            };

            const prompt = builder.build(minimalContext);
            expect(prompt).toContain("You are minimal-agent");
            expect(prompt).not.toContain("## Project Context");
            expect(prompt).not.toContain("## Available Agents");
            expect(prompt).not.toContain("## Project Rules");
        });

        it("should include predefined system prompt at the beginning", () => {
            const contextWithPredefined: SystemPromptContext = {
                ...mockContext,
                agentConfig: {
                    ...mockContext.agentConfig,
                    systemPrompt: "This is a predefined system prompt",
                },
            };

            const prompt = builder.build(contextWithPredefined);
            expect(prompt).toContain("This is a predefined system prompt");
            // Should still include other sections after the predefined prompt
            expect(prompt).toContain("## TENEX System Instructions");
            // Predefined prompt should come first
            expect(prompt.indexOf("This is a predefined system prompt")).toBeLessThan(
                prompt.indexOf("## TENEX System Instructions")
            );
        });
    });

    describe("agent-to-agent communication", () => {
        it("should include agent-to-agent section when flag is set", () => {
            const contextWithA2A: SystemPromptContext = {
                ...mockContext,
                isAgentToAgent: true,
            };

            const prompt = builder.build(contextWithA2A);
            expect(prompt).toContain("[AGENT-TO-AGENT COMMUNICATION]");
            expect(prompt).toContain("Anti-Chatter Guidelines");
        });

        it("should not include agent-to-agent section when flag is false", () => {
            const prompt = builder.build(mockContext);
            expect(prompt).not.toContain("[AGENT-TO-AGENT COMMUNICATION]");
        });
    });

    describe("configuration options", () => {
        it("should exclude sections based on configuration", () => {
            const customBuilder = new SystemPromptBuilder({
                includeStaticInstructions: false,
                includeTeamInformation: false,
            });

            const prompt = customBuilder.build(mockContext);
            expect(prompt).not.toContain("## TENEX System Instructions");
            expect(prompt).not.toContain("## Available Agents in the System");
            expect(prompt).toContain("## Your Identity");
            expect(prompt).toContain("## Project Context");
        });

        it("should exclude specific sections by ID", () => {
            const customBuilder = new SystemPromptBuilder({
                excludeSections: ["project-rules", "team-information"],
            });

            const prompt = customBuilder.build(mockContext);
            expect(prompt).not.toContain("## Project Rules");
            expect(prompt).not.toContain("## Available Agents in the System");
            expect(prompt).toContain("## Your Identity");
        });
    });

    describe("custom builders", () => {
        it("should include custom section builders", () => {
            const customSectionBuilder: PromptSectionBuilder = {
                id: "custom-section",
                name: "Custom Section",
                defaultPriority: 50,
                build: (context) => ({
                    id: "custom-section",
                    name: "Custom Section",
                    priority: 50,
                    content: `## Custom Section\nAgent: ${context.agentName}`,
                    enabled: true,
                }),
            };

            const customBuilder = new SystemPromptBuilder({
                customBuilders: [customSectionBuilder],
            });

            const prompt = customBuilder.build(mockContext);
            expect(prompt).toContain("## Custom Section");
            expect(prompt).toContain("Agent: test-agent");
        });

        it("should handle builder errors gracefully", () => {
            const errorBuilder: PromptSectionBuilder = {
                id: "error-section",
                name: "Error Section",
                defaultPriority: 50,
                build: () => {
                    throw new Error("Builder error");
                },
            };

            const customBuilder = new SystemPromptBuilder({
                customBuilders: [errorBuilder],
            });

            // Should not throw, just skip the erroring builder
            expect(() => customBuilder.build(mockContext)).not.toThrow();
        });
    });

    describe("section ordering", () => {
        it("should order sections by priority", () => {
            const prompt = builder.build(mockContext);
            const sections = prompt.split("\n\n");

            // Static instructions (100) should come before agent identity (90)
            const staticIndex = sections.findIndex((s) => s.includes("TENEX System Instructions"));
            const identityIndex = sections.findIndex((s) => s.includes("Your Identity"));
            expect(staticIndex).toBeLessThan(identityIndex);

            // Project rules (60) should come after team information (70)
            const teamIndex = sections.findIndex((s) => s.includes("Available Agents"));
            const rulesIndex = sections.findIndex((s) => s.includes("Project Rules"));
            expect(teamIndex).toBeLessThan(rulesIndex);
        });
    });

    describe("preview functionality", () => {
        it("should provide section preview with metadata", () => {
            const preview = builder.preview(mockContext);

            expect(preview.sections.length).toBeGreaterThan(0);
            expect(preview.totalLength).toBeGreaterThan(0);

            const staticSection = preview.sections.find((s) => s.id === "static-instructions");
            expect(staticSection).toBeDefined();
            expect(staticSection?.priority).toBe(100);
            expect(staticSection?.length).toBeGreaterThan(0);
        });
    });

    describe("dynamic configuration", () => {
        it("should toggle sections dynamically", () => {
            builder.toggleSection("project-rules", false);
            const prompt1 = builder.build(mockContext);
            expect(prompt1).not.toContain("## Project Rules");

            builder.toggleSection("project-rules", true);
            const prompt2 = builder.build(mockContext);
            expect(prompt2).toContain("## Project Rules");
        });

        it("should create new instance with modified config", () => {
            const newBuilder = builder.withConfig({
                includeStaticInstructions: false,
            });

            const originalPrompt = builder.build(mockContext);
            const newPrompt = newBuilder.build(mockContext);

            expect(originalPrompt).toContain("## TENEX System Instructions");
            expect(newPrompt).not.toContain("## TENEX System Instructions");
        });
    });

    describe("builder management", () => {
        it("should register and unregister builders", () => {
            const customBuilder: PromptSectionBuilder = {
                id: "dynamic-builder",
                name: "Dynamic Builder",
                defaultPriority: 75,
                build: () => ({
                    id: "dynamic-builder",
                    name: "Dynamic Builder",
                    priority: 75,
                    content: "## Dynamic Content",
                    enabled: true,
                }),
            };

            builder.registerBuilder(customBuilder);
            const prompt1 = builder.build(mockContext);
            expect(prompt1).toContain("## Dynamic Content");

            builder.unregisterBuilder("dynamic-builder");
            const prompt2 = builder.build(mockContext);
            expect(prompt2).not.toContain("## Dynamic Content");
        });

        it("should list all registered builders", () => {
            const builders = builder.getBuilders();
            const builderIds = builders.map((b) => b.id);

            expect(builderIds).toContain("static-instructions");
            expect(builderIds).toContain("agent-identity");
            expect(builderIds).toContain("project-context");
            expect(builderIds).toContain("team-information");
            expect(builderIds).toContain("project-rules");
            expect(builderIds).toContain("agent-to-agent");
        });
    });
});
