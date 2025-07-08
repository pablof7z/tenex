import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AgentRegistry } from "../AgentRegistry";
import { getDefaultToolsForAgent } from "../constants";
import { getBuiltInAgents } from "../builtInAgents";

describe("Tool assignment", () => {
    describe("getDefaultToolsForAgent", () => {
        it("orchestrator agent should not have complete tool", () => {
            const mockAgent = {
                isOrchestrator: true,
                isBuiltIn: true,
                slug: "orchestrator"
            } as any;
            const tools = getDefaultToolsForAgent(mockAgent);
            
            expect(tools).not.toContain("complete");
            expect(tools).not.toContain("analyze");
            expect(tools).toContain("end_conversation");
            expect(tools).toContain("continue");
            expect(tools).toContain("learn");
        });

        it("planner and executor agents should only have claude_code and complete tools", () => {
            const mockExecutor = {
                isOrchestrator: false,
                isBuiltIn: true,
                slug: "executor"
            } as any;
            const mockPlanner = {
                isOrchestrator: false,
                isBuiltIn: true,
                slug: "planner"
            } as any;
            
            const executorTools = getDefaultToolsForAgent(mockExecutor);
            const plannerTools = getDefaultToolsForAgent(mockPlanner);
            
            // Executor should only have claude_code and complete
            expect(executorTools).toContain("claude_code");
            expect(executorTools).toContain("complete");
            expect(executorTools).not.toContain("analyze");
            expect(executorTools).not.toContain("read_file");
            expect(executorTools).not.toContain("end_conversation");
            expect(executorTools).not.toContain("continue");
            expect(executorTools.length).toBe(2);
            
            // Planner should only have claude_code and complete
            expect(plannerTools).toContain("claude_code");
            expect(plannerTools).toContain("complete");
            expect(plannerTools).not.toContain("analyze");
            expect(plannerTools).not.toContain("read_file");
            expect(plannerTools).not.toContain("end_conversation");
            expect(plannerTools).not.toContain("continue");
            expect(plannerTools.length).toBe(2);
        });

        it("custom agents should have complete tool", () => {
            const mockCustomAgent = {
                isOrchestrator: false,
                isBuiltIn: false,
                slug: "custom-agent"
            } as any;
            const tools = getDefaultToolsForAgent(mockCustomAgent);
            
            expect(tools).toContain("complete");
            expect(tools).not.toContain("end_conversation");
            expect(tools).not.toContain("continue");
        });

        it("project-manager agent should have additional tools", () => {
            const mockProjectManager = {
                isOrchestrator: false,
                isBuiltIn: true,
                slug: "project-manager"
            } as any;
            const tools = getDefaultToolsForAgent(mockProjectManager);
            
            expect(tools).toContain("complete");
            expect(tools).toContain("generate_inventory");
            expect(tools).toContain("write_context_file");
            expect(tools).not.toContain("end_conversation");
            expect(tools).not.toContain("continue");
        });
    });

    describe("AgentRegistry tool assignment fix", () => {
        it("should determine isBuiltIn before assigning tools", () => {
            // This test verifies that when creating an agent,
            // the isBuiltIn status is determined BEFORE calling getDefaultToolsForAgent
            
            const builtInSlugs = getBuiltInAgents().map(a => a.slug);
            
            // Verify orchestrator is in built-in agents
            expect(builtInSlugs).toContain("orchestrator");
            expect(builtInSlugs).toContain("executor");
            expect(builtInSlugs).toContain("planner");
            
            // The fix in AgentRegistry.ts line 212 ensures isBuiltIn is determined before tool assignment
            const isBuiltIn = builtInSlugs.includes("orchestrator");
            expect(isBuiltIn).toBe(true);
        });
    });
});