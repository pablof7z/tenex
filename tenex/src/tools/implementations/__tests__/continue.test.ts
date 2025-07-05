import { describe, expect, it, mock } from "bun:test";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import { continueTool } from "../continue";
import type { ToolExecutionContext, ControlContext, ControlToolResult } from "@/tools/types";
import { EffectInterpreter, defaultCapabilities } from "@/tools/interpreter";
import { createToolExecutor } from "@/tools/executor";

// Mock dependencies
mock.module("@/services/ProjectContext", () => ({
  getProjectContext: () => ({
    agents: new Map([
      ["planner", { pubkey: "planner-pubkey", name: "Planner" }],
      ["executer", { pubkey: "executer-pubkey", name: "Executer" }],
      ["project-manager", { pubkey: "pm-pubkey", name: "Project Manager" }],
      ["frontend-expert", { pubkey: "frontend-pubkey", name: "Frontend Expert" }],
      ["backend-expert", { pubkey: "backend-pubkey", name: "Backend Expert" }],
      ["orchestrator", { pubkey: "orchestrator-pubkey", name: "Orchestrator" }],
    ]),
  }),
}));

mock.module("@/utils/logger", () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

describe("continueTool - Phase-based routing", () => {
  const mockConversation: Conversation = {
    id: "test-conversation",
    title: "Test Conversation",
    phase: "chat",
    history: [],
    agentContexts: new Map(),
    phaseStartedAt: Date.now(),
    metadata: {},
    phaseTransitions: [],
    executionTime: {
      totalSeconds: 0,
      isActive: false,
      lastUpdated: Date.now(),
    },
  };

  const mockOrchestrator: Agent = {
    id: "orchestrator",
    name: "Orchestrator",
    slug: "orchestrator",
    role: "Orchestrator",
    pubkey: "orchestrator-pubkey",
    instructions: "Orchestrator instructions",
    tools: ["complete", "continue"],
    llmConfig: "agents",
    isOrchestrator: true,
  };

  const context: ToolExecutionContext & ControlContext = {
    // Base context
    projectPath: "/test/project",
    conversationId: "test-conversation",
    phase: "chat",
    
    // Execution context
    agent: mockOrchestrator,
    agentId: mockOrchestrator.pubkey,
    agentName: mockOrchestrator.name,
    
    // Control context (orchestrator-specific)
    isOrchestrator: true,
    availableAgents: [
      { pubkey: "planner-pubkey", name: "Planner", role: "Planner" },
      { pubkey: "executer-pubkey", name: "Executer", role: "Executer" },
      { pubkey: "pm-pubkey", name: "Project Manager", role: "Project Manager" },
      { pubkey: "frontend-pubkey", name: "Frontend Expert", role: "Frontend Expert" },
      { pubkey: "backend-pubkey", name: "Backend Expert", role: "Backend Expert" },
    ],
    
    // Optional fields
    conversation: mockConversation,
    triggeringEvent: undefined,
  };

  // Helper function to execute tool and get result
  async function executeControl(input: any): Promise<ControlToolResult> {
    const executor = createToolExecutor(context, defaultCapabilities);
    const result = await executor.execute(continueTool, input);
    return result as ControlToolResult;
  }

  describe("Phase-based routing (no agents specified)", () => {
    it("should route to planner when phase is 'plan'", async () => {
      const result = await executeControl({
        phase: "plan",
        reason: "Need to plan the architecture",
        message: "Design the authentication system",
      });

      expect(result.success).toBe(true);
      expect(result.kind).toBe("control");
      expect(result.flow?.type).toBe("continue");
      expect(result.flow?.routing.destinations).toEqual(["planner-pubkey"]);
      expect(result.flow?.routing.phase).toBe("plan");
      expect(result.flow?.routing.reason).toBe("Need to plan the architecture");
      expect(result.flow?.routing.message).toBe("Design the authentication system");
    });

    it("should route to executer when phase is 'execute'", async () => {
      const result = await executeControl({
        phase: "execute",
        reason: "Ready to implement",
        message: "Build the calculator",
      });

      expect(result.success).toBe(true);
      expect(result.kind).toBe("control");
      expect(result.flow?.type).toBe("continue");
      expect(result.flow?.routing.destinations).toEqual(["executer-pubkey"]);
      expect(result.flow?.routing.phase).toBe("execute");
      expect(result.flow?.routing.reason).toBe("Ready to implement");
      expect(result.flow?.routing.message).toBe("Build the calculator");
    });

    it("should route to project-manager when phase is 'reflection'", async () => {
      const result = await executeControl({
        phase: "reflection",
        reason: "Analyze what was built",
        message: "Reflect on the implementation",
      });

      expect(result.success).toBe(true);
      expect(result.kind).toBe("control");
      expect(result.flow?.type).toBe("continue");
      expect(result.flow?.routing.destinations).toEqual(["pm-pubkey"]);
      expect(result.flow?.routing.phase).toBe("reflection");
      expect(result.flow?.routing.reason).toBe("Analyze what was built");
      expect(result.flow?.routing.message).toBe("Reflect on the implementation");
    });

    it("should fail when no agents and no phase specified", async () => {
      const result = await executeControl({
        reason: "Need to do something",
        message: "Do the thing",
      });

      expect(result.success).toBe(false);
      expect(result.kind).toBe("control");
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toBe("Either 'agents' or 'phase' must be specified");
    });

    it("should fail for phases without default agents", async () => {
      const result = await executeControl({
        phase: "review",
        reason: "Ready for review",
        message: "Review the code",
      });

      expect(result.success).toBe(false);
      expect(result.kind).toBe("control");
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toBe("No default agent for phase 'review'. Please specify agents explicitly.");
    });
  });

  describe("Explicit agent routing", () => {
    it("should route to specified agents even with phase", async () => {
      const result = await executeControl({
        phase: "execute",
        agents: ["frontend-expert", "backend-expert"],
        reason: "Need expert review",
        message: "Review this implementation",
      });

      expect(result.success).toBe(true);
      expect(result.kind).toBe("control");
      expect(result.flow?.type).toBe("continue");
      expect(result.flow?.routing.destinations).toEqual([
        "frontend-pubkey",
        "backend-pubkey",
      ]);
      expect(result.flow?.routing.phase).toBe("execute");
      expect(result.flow?.routing.reason).toBe("Need expert review");
      expect(result.flow?.routing.message).toBe("Review this implementation");
    });

    it("should validate agent slugs", async () => {
      const result = await executeControl({
        agents: ["invalid-agent"],
        reason: "Test routing",
        message: "Test message",
      });

      expect(result.success).toBe(false);
      expect(result.kind).toBe("control");
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toContain("Agents not found: invalid-agent");
      expect(result.error?.message).toContain("Available agents:");
    });

    it("should prevent routing to self", async () => {
      const result = await executeControl({
        agents: ["orchestrator"],
        reason: "Test self routing",
        message: "Test message",
      });

      expect(result.success).toBe(false);
      expect(result.kind).toBe("control");
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toBe("Cannot route to self (orchestrator)");
    });
  });

  describe("Enhanced handoff fields", () => {
    it("should include summary in metadata when provided", async () => {
      const result = await executeControl({
        phase: "execute",
        reason: "Implementing feature",
        message: "Build the authentication system",
        summary: "User wants JWT-based auth",
      });

      expect(result.success).toBe(true);
      expect(result.kind).toBe("control");
      expect(result.flow?.type).toBe("continue");
      expect(result.flow?.routing).toMatchObject({
        phase: "execute",
        destinations: ["executer-pubkey"],
        reason: "Implementing feature",
        message: "Build the authentication system",
        context: {
          summary: "User wants JWT-based auth",
        },
      });
    });
  });

  describe("Non-orchestrator usage", () => {
    it("should fail when non-orchestrator tries to use continue", async () => {
      const nonOrchestratorContext = {
        ...context,
        isOrchestrator: false,
        agent: {
          ...mockOrchestrator,
          isOrchestrator: false,
          slug: "planner",
        },
      };

      const executor = createToolExecutor(nonOrchestratorContext, defaultCapabilities);
      const result = await executor.execute(continueTool, {
        phase: "execute",
        reason: "Test",
        message: "Test",
      }) as ControlToolResult;

      expect(result.success).toBe(false);
      expect(result.kind).toBe("control");
      expect(result.error?.kind).toBe("execution");
      expect(result.error?.message).toBe("Control tools can only be executed by the orchestrator");
    });
  });
});