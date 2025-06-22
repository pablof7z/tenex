import { describe, it, expect, beforeEach, mock } from "bun:test";
import { RoutingLLM } from "../RoutingLLM";
import type { LLMService } from "@/llm/LLMService";
import type { Agent } from "@/agents/types";
import type { Conversation } from "@/conversations/types";
import { createMockLLMService, MockLLMResponse } from "@/test-utils/mocks";
import { createTestAgent, createTestConversation } from "@/test-utils/helpers/fixtures";

describe("RoutingLLM", () => {
  let routingLLM: RoutingLLM;
  let mockLLMService: ReturnType<typeof createMockLLMService>;

  beforeEach(() => {
    mockLLMService = createMockLLMService();
    routingLLM = new RoutingLLM(mockLLMService as any);
  });

  describe("routeNewConversation", () => {
    it("should route to appropriate agent based on message content", async () => {
      const agents: Agent[] = [
        createTestAgent({ 
          name: "Developer",
          role: "Software Developer",
          expertise: "Full-stack development, coding"
        }),
        createTestAgent({ 
          name: "Designer",
          role: "UI/UX Designer",
          expertise: "Design, user experience"
        }),
      ];

      const userMessage = "I need help building a React component";

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: "Developer",
          reasoning: "User needs help with React development",
          confidence: 0.9,
          phase: "chat",
        })
      ));

      const result = await routingLLM.routeNewConversation(userMessage, agents);

      expect(result.selectedAgent).toBe("Developer");
      expect(result.reasoning).toContain("React development");
      expect(result.confidence).toBe(0.9);
      expect(result.phase).toBe("chat");

      // Verify LLM was called with correct prompt
      const lastCall = mockLLMService.getLastCall();
      expect(lastCall?.messages[0].role).toBe("system");
      expect(lastCall?.messages[0].content).toContain("conversation router");
      expect(lastCall?.messages[1].content).toContain(userMessage);
    });

    it("should handle empty agent list", async () => {
      const agents: Agent[] = [];
      const userMessage = "Help me with something";

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: null,
          reasoning: "No agents available",
          confidence: 0,
          phase: "chat",
        })
      ));

      const result = await routingLLM.routeNewConversation(userMessage, agents);

      expect(result.selectedAgent).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it("should handle malformed LLM response", async () => {
      const agents = [createTestAgent()];
      const userMessage = "Test message";

      mockLLMService.setResponse(new MockLLMResponse("Not valid JSON"));

      await expect(
        routingLLM.routeNewConversation(userMessage, agents)
      ).rejects.toThrow();
    });

    it("should use routing config for LLM call", async () => {
      const agents = [createTestAgent()];
      const userMessage = "Test";

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: "TestAgent",
          reasoning: "Test",
          confidence: 1,
          phase: "chat",
        })
      ));

      await routingLLM.routeNewConversation(userMessage, agents);

      expect(mockLLMService.callHistory[0].config).toBe("routing");
    });
  });

  describe("routePhaseTransition", () => {
    it("should route phase transition correctly", async () => {
      const agents = [
        createTestAgent({ name: "Planner", expertise: "Planning and architecture" }),
        createTestAgent({ name: "Developer", expertise: "Implementation" }),
      ];

      const conversation = createTestConversation({
        phase: "chat",
        metadata: { chat_summary: "User wants to build a web app" },
      });

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: "Planner",
          reasoning: "Moving to plan phase, need architect",
          confidence: 0.95,
          nextPhase: "plan",
          phaseContext: "Design the web application architecture",
        })
      ));

      const result = await routingLLM.routePhaseTransition(
        conversation,
        "plan",
        agents
      );

      expect(result.selectedAgent).toBe("Planner");
      expect(result.nextPhase).toBe("plan");
      expect(result.phaseContext).toContain("architecture");
      expect(result.confidence).toBe(0.95);
    });

    it("should include conversation history in routing decision", async () => {
      const agents = [createTestAgent()];
      const conversation = createTestConversation({
        history: [
          { content: "Build a TODO app" } as any,
          { content: "Use React and TypeScript" } as any,
        ],
      });

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: "TestAgent",
          reasoning: "Test",
          confidence: 1,
          nextPhase: "plan",
        })
      ));

      await routingLLM.routePhaseTransition(conversation, "plan", agents);

      const lastCall = mockLLMService.getLastCall();
      expect(lastCall?.messages[1].content).toContain("TODO app");
      expect(lastCall?.messages[1].content).toContain("React and TypeScript");
    });
  });

  describe("routeAgentHandoff", () => {
    it("should route handoff request to appropriate agent", async () => {
      const currentAgent = createTestAgent({ 
        name: "Developer",
        expertise: "Backend development"
      });
      
      const agents = [
        currentAgent,
        createTestAgent({ 
          name: "Designer",
          expertise: "UI/UX Design"
        }),
        createTestAgent({ 
          name: "DevOps",
          expertise: "Infrastructure and deployment"
        }),
      ];

      const conversation = createTestConversation();
      const handoffReason = "Need help with UI design for the dashboard";

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: "Designer",
          reasoning: "Developer needs UI/UX expertise for dashboard",
          confidence: 0.88,
          handoffContext: "Design dashboard UI components",
        })
      ));

      const result = await routingLLM.routeAgentHandoff(
        conversation,
        currentAgent,
        handoffReason,
        agents
      );

      expect(result.selectedAgent).toBe("Designer");
      expect(result.handoffContext).toContain("dashboard UI");
      expect(result.confidence).toBe(0.88);

      // Verify current agent is excluded from selection
      const lastCall = mockLLMService.getLastCall();
      expect(lastCall?.messages[1].content).not.toContain('"Developer"');
      expect(lastCall?.messages[1].content).toContain('"Designer"');
      expect(lastCall?.messages[1].content).toContain('"DevOps"');
    });

    it("should handle case where no suitable agent is found", async () => {
      const currentAgent = createTestAgent({ name: "Developer" });
      const agents = [currentAgent]; // Only current agent available

      const conversation = createTestConversation();

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: null,
          reasoning: "No other agents available",
          confidence: 0,
        })
      ));

      const result = await routingLLM.routeAgentHandoff(
        conversation,
        currentAgent,
        "Need help",
        agents
      );

      expect(result.selectedAgent).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe("prompt construction", () => {
    it("should include agent details in routing prompt", async () => {
      const agents = [
        createTestAgent({ 
          name: "Agent1",
          role: "Role1",
          expertise: "Expertise1",
          tools: ["tool1", "tool2"]
        }),
        createTestAgent({ 
          name: "Agent2",
          role: "Role2",
          expertise: "Expertise2",
          tools: []
        }),
      ];

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: "Agent1",
          reasoning: "Test",
          confidence: 1,
          phase: "chat",
        })
      ));

      await routingLLM.routeNewConversation("Test", agents);

      const lastCall = mockLLMService.getLastCall();
      const systemMessage = lastCall?.messages[0].content || "";
      
      // Check that agent details are included
      expect(systemMessage).toContain("Agent1");
      expect(systemMessage).toContain("Role1");
      expect(systemMessage).toContain("Expertise1");
      expect(systemMessage).toContain("tool1");
      expect(systemMessage).toContain("tool2");
      expect(systemMessage).toContain("Agent2");
    });

    it("should format conversation history properly", async () => {
      const agents = [createTestAgent()];
      const conversation = createTestConversation({
        history: [
          { 
            kind: 11,
            content: "Initial message",
            pubkey: "user123",
            created_at: 1000,
          } as any,
          { 
            kind: 1,
            content: "Agent response",
            pubkey: "agent456",
            created_at: 1100,
          } as any,
        ],
      });

      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          selectedAgent: "TestAgent",
          reasoning: "Test",
          confidence: 1,
          nextPhase: "plan",
        })
      ));

      await routingLLM.routePhaseTransition(conversation, "plan", agents);

      const lastCall = mockLLMService.getLastCall();
      const userMessage = lastCall?.messages[1].content || "";
      
      expect(userMessage).toContain("User (user123): Initial message");
      expect(userMessage).toContain("Agent (agent456): Agent response");
    });
  });

  describe("error handling", () => {
    it("should handle LLM service errors", async () => {
      const agents = [createTestAgent()];
      
      mockLLMService.setThrowError(new Error("LLM service unavailable"));

      await expect(
        routingLLM.routeNewConversation("Test", agents)
      ).rejects.toThrow("LLM service unavailable");
    });

    it("should handle invalid JSON responses", async () => {
      const agents = [createTestAgent()];
      
      mockLLMService.setResponse(new MockLLMResponse("{invalid json"));

      await expect(
        routingLLM.routeNewConversation("Test", agents)
      ).rejects.toThrow();
    });

    it("should handle missing required fields in response", async () => {
      const agents = [createTestAgent()];
      
      mockLLMService.setResponse(new MockLLMResponse(
        JSON.stringify({
          // Missing selectedAgent field
          reasoning: "Test",
          confidence: 1,
        })
      ));

      const result = await routingLLM.routeNewConversation("Test", agents);
      
      // Should handle gracefully with defaults
      expect(result.selectedAgent).toBeUndefined();
      expect(result.reasoning).toBe("Test");
      expect(result.confidence).toBe(1);
    });
  });
});