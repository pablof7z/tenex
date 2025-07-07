import { describe, expect, it, mock } from "bun:test";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import { continueTool } from "../continue";
import type { ExecutionContext, ControlFlow } from "@/tools/types";
import type { ToolExecutionResult } from "@/tools/executor";
import { createToolExecutor } from "@/tools/executor";

// Mock dependencies
mock.module("@/services/ProjectContext", () => ({
  getProjectContext: () => ({
    agents: new Map([
      ["planner", { pubkey: "planner-pubkey", name: "Planner" }],
      ["executor", { pubkey: "executor-pubkey", name: "Executor" }],
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

describe("continueTool - Agent routing", () => {
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

  const context: ExecutionContext = {
    // Base context
    projectPath: "/test/project",
    conversationId: "test-conversation",
    phase: "chat",
    
    // Execution context
    agent: mockOrchestrator,
    
    // Required fields
    conversation: mockConversation,
    publisher: {
      publishResponse: mock(),
    } as any,
    triggeringEvent: undefined,
  };

  // Helper function to execute tool and get result
  async function executeControl(input: any): Promise<ToolExecutionResult<ControlFlow>> {
    const executor = createToolExecutor(context);
    const result = await executor.execute(continueTool, input);
    return result;
  }

  describe("Required agents parameter", () => {
    it("should fail when no agents specified", async () => {
      const result = await executeControl({
        phase: "plan",
        reason: "Need to plan the architecture",
        message: "Design the authentication system",
      });

      expect(result.success).toBe(false);
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toBe("Required");
    });

    it("should fail when agents array is empty", async () => {
      const result = await executeControl({
        agents: [],
        reason: "Test routing",
        message: "Test message",
      });

      expect(result.success).toBe(false);
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toBe("Agents array cannot be empty");
    });

    it("should succeed with valid agents", async () => {
      const result = await executeControl({
        agents: ["planner"],
        phase: "plan",
        reason: "Need to plan the architecture",
        message: "Design the authentication system",
      });

      expect(result.success).toBe(true);
      expect(result.output?.type).toBe("continue");
      expect(result.output?.routing.agents).toEqual(["planner-pubkey"]);
      expect(result.output?.routing.phase).toBe("plan");
      expect(result.output?.routing.reason).toBe("Need to plan the architecture");
      expect(result.output?.routing.message).toBe("Design the authentication system");
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
      expect(result.output?.type).toBe("continue");
      expect(result.output?.routing.agents).toEqual([
        "frontend-pubkey",
        "backend-pubkey",
      ]);
      expect(result.output?.routing.phase).toBe("execute");
      expect(result.output?.routing.reason).toBe("Need expert review");
      expect(result.output?.routing.message).toBe("Review this implementation");
    });

    it("should validate agent slugs", async () => {
      const result = await executeControl({
        agents: ["invalid-agent"],
        reason: "Test routing",
        message: "Test message",
      });

      expect(result.success).toBe(false);
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
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toBe("Cannot route to self (orchestrator)");
    });
  });

  describe("Enhanced handoff fields", () => {
    it("should include summary in metadata when provided", async () => {
      const result = await executeControl({
        agents: ["executor"],
        phase: "execute",
        reason: "Implementing feature",
        message: "Build the authentication system",
        summary: "User wants JWT-based auth",
      });

      expect(result.success).toBe(true);
      expect(result.output?.type).toBe("continue");
      expect(result.output?.routing).toMatchObject({
        phase: "execute",
        agents: ["executor-pubkey"],
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
        agent: {
          ...mockOrchestrator,
          isOrchestrator: false,
          slug: "planner",
        },
      };

      const executor = createToolExecutor(nonOrchestratorContext);
      const result = await executor.execute(continueTool, {
        agents: ["executor"],
        phase: "execute",
        reason: "Test",
        message: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error?.kind).toBe("execution");
      expect(result.error?.message).toBe("Only orchestrator can use continue tool");
    });
  });

  describe("Case insensitive phase handling", () => {
    it("should handle uppercase phase names", async () => {
      const executor = createToolExecutor(context);
      const result = await executor.execute(continueTool, {
        agents: ["executor"],
        phase: "CHORES" as any,
        reason: "Here is why I decided this path: Testing uppercase",
        message: "Test message",
      });

      expect(result.success).toBe(true);
      if (result.success && result.value?.type === "continue") {
        expect(result.value.routing.phase).toBe("chores");
      }
    });

    it("should handle mixed case phase names", async () => {
      const executor = createToolExecutor(context);
      const result = await executor.execute(continueTool, {
        agents: ["planner"],
        phase: "ReFlEcTiOn" as any,
        reason: "Here is why I decided this path: Testing mixed case",
        message: "Test message",
      });

      expect(result.success).toBe(true);
      if (result.success && result.value?.type === "continue") {
        expect(result.value.routing.phase).toBe("reflection");
      }
    });

    it("should reject invalid phase names", async () => {
      const executor = createToolExecutor(context);
      const result = await executor.execute(continueTool, {
        agents: ["executor"],
        phase: "INVALID_PHASE" as any,
        reason: "Here is why I decided this path: Testing invalid",
        message: "Test message",
      });

      expect(result.success).toBe(false);
      expect(result.error?.kind).toBe("validation");
      expect(result.error?.message).toContain("Invalid phase");
    });
  });
});