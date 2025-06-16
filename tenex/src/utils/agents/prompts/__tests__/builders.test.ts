import { describe, expect, it } from "bun:test";
import {
    AgentIdentityBuilder,
    AgentToAgentBuilder,
    ProjectContextBuilder,
    ProjectRulesBuilder,
    StaticInstructionsBuilder,
    TeamInformationBuilder,
} from "../builders";
import type { SystemPromptContext } from "../types";

describe("Prompt Section Builders", () => {
    const baseContext: SystemPromptContext = {
        agentName: "test-agent",
        agentConfig: {
            name: "test-agent",
        },
    };

    describe("StaticInstructionsBuilder", () => {
        const builder = new StaticInstructionsBuilder();

        it("should have correct metadata", () => {
            expect(builder.id).toBe("static-instructions");
            expect(builder.defaultPriority).toBe(100);
        });

        it("should build static instructions", () => {
            const section = builder.build(baseContext);
            expect(section.content).toContain("TENEX System Instructions");
            expect(section.content).toContain("Context First");
            expect(section.content).toContain("Collaborative Work");
            expect(section.enabled).toBe(true);
        });
    });

    describe("AgentIdentityBuilder", () => {
        const builder = new AgentIdentityBuilder();

        it("should build identity with role", () => {
            const context: SystemPromptContext = {
                ...baseContext,
                agentConfig: {
                    name: "test-agent",
                    role: "Senior Developer",
                    description: "Writes production code",
                    instructions: "Follow best practices",
                    provider: "anthropic",
                    model: "claude-3",
                },
            };

            const section = builder.build(context);
            expect(section.content).toContain("You are Senior Developer");
            expect(section.content).toContain("Writes production code");
            expect(section.content).toContain("Follow best practices");
            expect(section.content).toContain("Provider: anthropic");
            expect(section.content).toContain("Model: claude-3");
        });

        it("should build identity without role", () => {
            const section = builder.build(baseContext);
            expect(section.content).toContain("You are test-agent");
        });
    });

    describe("ProjectContextBuilder", () => {
        const builder = new ProjectContextBuilder();

        it("should return null without project info", () => {
            const section = builder.build(baseContext);
            expect(section).toBeNull();
        });

        it("should build project context", () => {
            const context: SystemPromptContext = {
                ...baseContext,
                projectInfo: {
                    id: "project-1",
                    naddr: "naddr1",
                    title: "Awesome Project",
                    description: "A great project",
                    repository: "https://github.com/test/repo",
                    hashtags: ["javascript", "react"],
                    metadata: {
                        title: "Awesome Project",
                        naddr: "naddr1",
                    },
                },
            };

            const section = builder.build(context);
            expect(section).not.toBeNull();
            expect(section?.content).toContain("Awesome Project");
            expect(section?.content).toContain("A great project");
            expect(section?.content).toContain("https://github.com/test/repo");
            expect(section?.content).toContain("javascript, react");
        });
    });

    describe("TeamInformationBuilder", () => {
        const builder = new TeamInformationBuilder();

        it("should return null without other agents", () => {
            const section = builder.build(baseContext);
            expect(section).toBeNull();
        });

        it("should build team information", () => {
            const context: SystemPromptContext = {
                ...baseContext,
                otherAgents: [
                    { name: "code-agent", description: "Writes code", role: "Developer" },
                    { name: "test-agent", description: "Current agent" }, // Should be filtered
                    { name: "review-agent", description: "Reviews PRs" },
                ],
            };

            const section = builder.build(context);
            expect(section).not.toBeNull();
            expect(section?.content).toContain("code-agent");
            expect(section?.content).toContain("Writes code");
            expect(section?.content).toContain("(Role: Developer)");
            expect(section?.content).not.toContain("Current agent");
            expect(section?.content).toContain("@agent-name");
        });
    });

    describe("ProjectRulesBuilder", () => {
        const builder = new ProjectRulesBuilder();

        it("should return null without rules", () => {
            const section = builder.build(baseContext);
            expect(section).toBeNull();
        });

        it("should build rules from cached rules", () => {
            const context: SystemPromptContext = {
                ...baseContext,
                projectRules: [
                    {
                        id: "rule1",
                        eventId: "event1",
                        title: "Coding Standards",
                        description: "Follow these standards",
                        content: "Use TypeScript",
                        fetchedAt: Date.now(),
                    },
                ],
            };

            const section = builder.build(context);
            expect(section).not.toBeNull();
            expect(section?.content).toContain("Coding Standards");
            expect(section?.content).toContain("Follow these standards");
            expect(section?.content).toContain("Use TypeScript");
        });

        it("should build with additional rules only", () => {
            const context: SystemPromptContext = {
                ...baseContext,
                additionalRules: "Always document your code",
            };

            const section = builder.build(context);
            expect(section).not.toBeNull();
            expect(section?.content).toContain("Always document your code");
            expect(section?.content).not.toContain("Additional Rules");
        });

        it("should combine cached and additional rules", () => {
            const context: SystemPromptContext = {
                ...baseContext,
                projectRules: [
                    {
                        id: "rule1",
                        eventId: "event1",
                        title: "Style Guide",
                        content: "Use Prettier",
                        fetchedAt: Date.now(),
                    },
                ],
                additionalRules: "Write tests for everything",
            };

            const section = builder.build(context);
            expect(section).not.toBeNull();
            expect(section?.content).toContain("Style Guide");
            expect(section?.content).toContain("Use Prettier");
            expect(section?.content).toContain("Additional Rules");
            expect(section?.content).toContain("Write tests for everything");
        });
    });

    describe("AgentToAgentBuilder", () => {
        const builder = new AgentToAgentBuilder();

        it("should return null when not agent-to-agent", () => {
            const section = builder.build(baseContext);
            expect(section).toBeNull();
        });

        it("should build agent-to-agent instructions", () => {
            const context: SystemPromptContext = {
                ...baseContext,
                isAgentToAgent: true,
            };

            const section = builder.build(context);
            expect(section).not.toBeNull();
            expect(section?.content).toContain("[AGENT-TO-AGENT COMMUNICATION]");
            expect(section?.content).toContain("Anti-Chatter Guidelines");
            expect(section?.content).toContain("When to Respond");
            expect(section?.priority).toBe(95); // High priority
        });
    });
});
