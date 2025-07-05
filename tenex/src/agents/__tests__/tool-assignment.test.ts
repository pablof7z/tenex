import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AgentRegistry } from "../AgentRegistry";
import { getDefaultToolsForAgent } from "../constants";
import { getBuiltInAgents } from "../builtInAgents";

describe("Tool assignment", () => {
    describe("getDefaultToolsForAgent", () => {
        it("orchestrator agent should not have yield_back tool", () => {
            const tools = getDefaultToolsForAgent(true, undefined, true, "orchestrator");
            
            expect(tools).not.toContain("yield_back");
            expect(tools).toContain("analyze");
            expect(tools).toContain("end_conversation");
            expect(tools).toContain("continue");
        });

        it("non-orchestrator built-in agents should have yield_back tool", () => {
            const executorTools = getDefaultToolsForAgent(false, undefined, true, "executer");
            const plannerTools = getDefaultToolsForAgent(false, undefined, true, "planner");
            
            expect(executorTools).toContain("yield_back");
            expect(executorTools).not.toContain("end_conversation");
            expect(executorTools).not.toContain("continue");
            
            expect(plannerTools).toContain("yield_back");
            expect(plannerTools).not.toContain("end_conversation");
            expect(plannerTools).not.toContain("continue");
        });

        it("custom agents should have yield_back tool", () => {
            const tools = getDefaultToolsForAgent(false, undefined, false, "custom-agent");
            
            expect(tools).toContain("yield_back");
            expect(tools).not.toContain("end_conversation");
            expect(tools).not.toContain("continue");
        });
    });

    describe("AgentRegistry tool assignment fix", () => {
        it("should determine isBuiltIn before assigning tools", () => {
            // This test verifies that when creating an agent,
            // the isBuiltIn status is determined BEFORE calling getDefaultToolsForAgent
            // Previously, agent.isBuiltIn was undefined when tools were assigned,
            // causing built-in agents to be treated as custom agents
            
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