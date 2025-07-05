import { describe, expect, it, mock } from "bun:test";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import { continueTool } from "../continue";
import type { ToolExecutionContext } from "@/tools/types";

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

  const context: ToolExecutionContext = {
    agent: mockOrchestrator,
    conversation: mockConversation,
    conversationId: "test-conversation",
    triggeringEvent: undefined,
  };

  describe("Phase-based routing (no agents specified)", () => {
    it("should route to planner when phase is 'plan'", async () => {
      const result = await continueTool.execute(
        {
          phase: "plan",
          reason: "Need to plan the architecture",
          message: "Design the authentication system",
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.routingDecision?.destinations).toEqual(["planner-pubkey"]);
      expect(result.output).toContain("Routing to Planner in plan phase");
    });

    it("should route to executer when phase is 'execute'", async () => {
      const result = await continueTool.execute(
        {
          phase: "execute",
          reason: "Ready to implement",
          message: "Build the calculator",
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.routingDecision?.destinations).toEqual(["executer-pubkey"]);
      expect(result.output).toContain("Routing to Executer in execute phase");
    });

    it("should route to project-manager when phase is 'reflection'", async () => {
      const result = await continueTool.execute(
        {
          phase: "reflection",
          reason: "Analyze what was built",
          message: "Reflect on the implementation",
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.routingDecision?.destinations).toEqual(["pm-pubkey"]);
      expect(result.output).toContain("Routing to Project Manager in reflection phase");
    });

    it("should fail when no agents and no phase specified", async () => {
      const result = await continueTool.execute(
        {
          reason: "Need to do something",
          message: "Do the thing",
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Either 'agents' or 'phase' must be specified");
    });

    it("should fail for phases without default agents", async () => {
      const result = await continueTool.execute(
        {
          phase: "review",
          reason: "Ready for review",
          message: "Review the code",
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No default agent for phase 'review'. Please specify agents explicitly.");
    });
  });

  describe("Explicit agent routing", () => {
    it("should route to specified agents even with phase", async () => {
      const result = await continueTool.execute(
        {
          phase: "execute",
          agents: ["frontend-expert", "backend-expert"],
          reason: "Need expert review",
          message: "Review this implementation",
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.routingDecision?.destinations).toEqual([
        "frontend-pubkey",
        "backend-pubkey",
      ]);
      expect(result.output).toContain("Routing to multiple agents: Frontend Expert, Backend Expert");
    });

    it("should validate agent slugs", async () => {
      const result = await continueTool.execute(
        {
          agents: ["invalid-agent"],
          reason: "Test routing",
          message: "Test message",
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Agents not found: invalid-agent");
      expect(result.error).toContain("Available agents:");
    });

    it("should prevent routing to self", async () => {
      const result = await continueTool.execute(
        {
          agents: ["orchestrator"],
          reason: "Test self routing",
          message: "Test message",
        },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot route to self (orchestrator)");
    });
  });

  describe("Enhanced handoff fields", () => {
    it("should include summary in metadata when provided", async () => {
      const result = await continueTool.execute(
        {
          phase: "execute",
          reason: "Implementing feature",
          message: "Build the authentication system",
          summary: "User wants JWT-based auth",
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.routingDecision).toMatchObject({
        phase: "execute",
        destinations: ["executer-pubkey"],
        reason: "Implementing feature",
        message: "Build the authentication system",
        summary: "User wants JWT-based auth",
      });
    });
  });

  describe("Non-orchestrator usage", () => {
    it("should fail when non-orchestrator tries to use continue", async () => {
      const nonOrchestrator: Agent = {
        ...mockOrchestrator,
        isOrchestrator: false,
        slug: "planner",
      };

      const result = await continueTool.execute(
        {
          phase: "execute",
          reason: "Test",
          message: "Test",
        },
        { ...context, agent: nonOrchestrator }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Only the orchestrator agent can use the continue tool");
    });
  });
});