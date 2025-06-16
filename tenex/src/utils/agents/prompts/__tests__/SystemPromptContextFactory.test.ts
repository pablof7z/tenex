import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../../../../commands/run/ProjectLoader";
import type { CachedRule } from "../../../RulesManager";
import type { Agent } from "../../Agent";
import type { AgentConfig } from "../../types";
import { SystemPromptContextFactory } from "../SystemPromptContextFactory";

describe("SystemPromptContextFactory", () => {
    const mockAgent: Agent = {
        getName: vi.fn().mockReturnValue("test-agent"),
        getConfig: vi.fn().mockReturnValue({
            role: "test",
            instructions: "test instructions",
            systemPrompt: "test system prompt",
        } as AgentConfig),
        getAvailableTools: vi.fn().mockReturnValue(["tool1", "tool2"]),
    } as any;

    const mockProjectInfo: ProjectInfo = {
        rulesManager: {
            getRulesForAgent: vi.fn().mockReturnValue([
                { id: "rule1", content: "Test rule 1" },
                { id: "rule2", content: "Test rule 2" },
            ] as CachedRule[]),
            formatRulesForPrompt: vi.fn().mockReturnValue("Formatted rules"),
        },
        ruleMappings: new Map([["test-agent", ["rule1", "rule2"]]]),
        specCache: {
            getSpec: vi.fn(),
            hasSpec: vi.fn(),
        },
    } as any;

    const mockGetAllAvailableAgents = vi.fn().mockResolvedValue(
        new Map([
            ["test-agent", { description: "Test agent", role: "test", capabilities: "testing" }],
            [
                "other-agent",
                { description: "Other agent", role: "helper", capabilities: "helping" },
            ],
        ])
    );

    const mockFormatAvailableAgentsForPrompt = vi.fn().mockResolvedValue("Available agents info");

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createContext", () => {
        it("should create a complete SystemPromptContext with all dependencies", async () => {
            const factory = new SystemPromptContextFactory(mockProjectInfo, {
                getAllAvailableAgents: mockGetAllAvailableAgents,
                formatAvailableAgentsForPrompt: mockFormatAvailableAgentsForPrompt,
            });

            const context = await factory.createContext(mockAgent, false);

            expect(context).toEqual({
                agentName: "test-agent",
                agentConfig: {
                    role: "test",
                    instructions: "test instructions",
                    systemPrompt: "test system prompt",
                },
                projectInfo: mockProjectInfo,
                availableTools: ["tool1", "tool2"],
                otherAgents: [
                    {
                        name: "other-agent",
                        description: "Other agent",
                        role: "helper",
                    },
                ],
                projectRules: [
                    { id: "rule1", content: "Test rule 1" },
                    { id: "rule2", content: "Test rule 2" },
                ],
                additionalRules: "Formatted rulesAvailable agents info",
                isAgentToAgent: false,
                specCache: mockProjectInfo.specCache,
            });
        });

        it("should set isAgentToAgent flag correctly", async () => {
            const factory = new SystemPromptContextFactory(mockProjectInfo);

            const context = await factory.createContext(mockAgent, true);

            expect(context.isAgentToAgent).toBe(true);
        });

        it("should handle missing project info gracefully", async () => {
            const factory = new SystemPromptContextFactory(undefined);

            const context = await factory.createContext(mockAgent);

            expect(context.projectInfo).toBeUndefined();
            expect(context.projectRules).toEqual([]);
            expect(context.additionalRules).toBeUndefined();
            expect(context.specCache).toBeUndefined();
        });

        it("should handle missing rules manager gracefully", async () => {
            const projectInfoWithoutRules = {
                ...mockProjectInfo,
                rulesManager: undefined,
                ruleMappings: undefined,
            };

            const factory = new SystemPromptContextFactory(projectInfoWithoutRules);

            const context = await factory.createContext(mockAgent);

            expect(context.projectRules).toEqual([]);
            expect(context.additionalRules).toBeUndefined();
        });

        it("should handle missing agent dependencies gracefully", async () => {
            const factory = new SystemPromptContextFactory(mockProjectInfo);

            const context = await factory.createContext(mockAgent);

            expect(context.otherAgents).toEqual([]);
            expect(context.additionalRules).toBe("Formatted rules");
        });

        it("should filter out the current agent from other agents list", async () => {
            const factory = new SystemPromptContextFactory(mockProjectInfo, {
                getAllAvailableAgents: mockGetAllAvailableAgents,
            });

            const context = await factory.createContext(mockAgent);

            expect(context.otherAgents).toHaveLength(1);
            expect(context.otherAgents?.[0]?.name).toBe("other-agent");
            expect(context.otherAgents?.some((agent) => agent.name === "test-agent")).toBe(false);
        });

        it("should handle getAllAvailableAgents throwing an error", async () => {
            const failingGetAllAgents = vi.fn().mockRejectedValue(new Error("Agent lookup failed"));

            const factory = new SystemPromptContextFactory(mockProjectInfo, {
                getAllAvailableAgents: failingGetAllAgents,
            });

            const context = await factory.createContext(mockAgent);

            expect(context.otherAgents).toEqual([]);
        });

        it("should handle formatAvailableAgentsForPrompt throwing an error", async () => {
            const failingFormatAgents = vi.fn().mockRejectedValue(new Error("Format failed"));

            const factory = new SystemPromptContextFactory(mockProjectInfo, {
                formatAvailableAgentsForPrompt: failingFormatAgents,
            });

            const context = await factory.createContext(mockAgent);

            expect(context.additionalRules).toBe("Formatted rules");
        });
    });

    describe("dependency management", () => {
        it("should allow updating project info", () => {
            const factory = new SystemPromptContextFactory();
            const newProjectInfo = { ...mockProjectInfo, title: "Updated Project" } as any;

            factory.updateProjectInfo(newProjectInfo);

            // The updated project info should be used in subsequent context creation
            expect(factory.projectInfo).toBe(newProjectInfo);
        });

        it("should allow updating dependencies", async () => {
            const factory = new SystemPromptContextFactory(mockProjectInfo);

            // Initially no dependencies
            const initialContext = await factory.createContext(mockAgent);
            expect(initialContext.otherAgents).toEqual([]);

            // Update dependencies
            factory.updateDependencies({
                getAllAvailableAgents: mockGetAllAvailableAgents,
                formatAvailableAgentsForPrompt: mockFormatAvailableAgentsForPrompt,
            });

            // Now dependencies should work
            const updatedContext = await factory.createContext(mockAgent);
            expect(updatedContext.otherAgents).toHaveLength(1);
            expect(updatedContext.additionalRules).toContain("Available agents info");
        });
    });

    describe("additional rules building", () => {
        it("should combine agent rules and agent info when both exist", async () => {
            const factory = new SystemPromptContextFactory(mockProjectInfo, {
                formatAvailableAgentsForPrompt: mockFormatAvailableAgentsForPrompt,
            });

            const context = await factory.createContext(mockAgent);

            expect(context.additionalRules).toBe("Formatted rulesAvailable agents info");
        });

        it("should return only agent rules when agent info is missing", async () => {
            const factory = new SystemPromptContextFactory(mockProjectInfo);

            const context = await factory.createContext(mockAgent);

            expect(context.additionalRules).toBe("Formatted rules");
        });

        it("should return only agent info when agent rules are missing", async () => {
            const projectInfoWithoutRules = {
                ...mockProjectInfo,
                rulesManager: undefined,
            };

            const factory = new SystemPromptContextFactory(projectInfoWithoutRules, {
                formatAvailableAgentsForPrompt: mockFormatAvailableAgentsForPrompt,
            });

            const context = await factory.createContext(mockAgent);

            expect(context.additionalRules).toBe("Available agents info");
        });

        it("should return undefined when both agent rules and agent info are missing", async () => {
            const factory = new SystemPromptContextFactory();

            const context = await factory.createContext(mockAgent);

            expect(context.additionalRules).toBeUndefined();
        });
    });
});
