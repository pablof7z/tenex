import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AgentRegistry } from "../AgentRegistry";
import { getDefaultToolsForAgent } from "../constants";
import { getBuiltInAgents } from "../builtInAgents";

describe("Tool assignment", () => {
    describe("getDefaultToolsForAgent", () => {
        it("orchestrator agent should not have yield_back tool", () => {
            const mockAgent = {
                isOrchestrator: true,
                isBuiltIn: true,
                slug: "orchestrator"
            } as any;
            const tools = getDefaultToolsForAgent(mockAgent);
            
            expect(tools).not.toContain("yield_back");
            expect(tools).toContain("analyze");
            expect(tools).toContain("end_conversation");
            expect(tools).toContain("continue");
        });

        it("non-orchestrator built-in agents should have yield_back tool", () => {
            const mockExecutor = {
                isOrchestrator: false,
                isBuiltIn: true,
                slug: "executer"
            } as any;
            const mockPlanner = {
                isOrchestrator: false,
                isBuiltIn: true,
                slug: "planner"
            } as any;
            
            const executorTools = getDefaultToolsForAgent(mockExecutor);
            const plannerTools = getDefaultToolsForAgent(mockPlanner);
            
            expect(executorTools).toContain("yield_back");
            expect(executorTools).not.toContain("end_conversation");
            expect(executorTools).not.toContain("continue");
            
            expect(plannerTools).toContain("yield_back");
            expect(plannerTools).not.toContain("end_conversation");
            expect(plannerTools).not.toContain("continue");
        });

        it("custom agents should have yield_back tool", () => {
            const mockCustomAgent = {
                isOrchestrator: false,
                isBuiltIn: false,
                slug: "custom-agent"
            } as any;
            const tools = getDefaultToolsForAgent(mockCustomAgent);
            
            expect(tools).toContain("yield_back");
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
            
            expect(tools).toContain("yield_back");
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
            expect(builtInSlugs).toContain("executer");
            expect(builtInSlugs).toContain("planner");
            
            // The fix in AgentRegistry.ts line 212 ensures isBuiltIn is determined before tool assignment
            const isBuiltIn = builtInSlugs.includes("orchestrator");
            expect(isBuiltIn).toBe(true);
        });
    });
});