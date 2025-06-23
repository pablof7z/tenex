import { describe, it, expect } from "bun:test";
import { evaluatePhaseCompletion } from "../phase-completion";
import type { Conversation } from "@/conversations/types";

// Simple test conversation factory
function createTestConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: "test-conv-1",
    phase: "chat",
    history: [],
    status: "active",
    startTime: Date.now(),
    metadata: {},
    ...overrides
  };
}

describe("evaluatePhaseCompletion", () => {
  describe("plan phase completion", () => {
    it("should not allow transition without user approval", () => {
      const conversation: Conversation = createTestConversation({
        phase: "plan",
        metadata: {
          plan_summary: "Test plan",
          architecture: "Test architecture",
          tasks: ["Task 1", "Task 2"],
          // Missing plan_approved
        }
      });

      const result = evaluatePhaseCompletion("plan", conversation);
      
      expect(result.completed).toBe(false);
      expect(result.criteria.plan?.userApproval).toBe(false);
      expect(result.outcome).toBe("pending");
    });

    it("should allow transition with all criteria met", () => {
      const conversation: Conversation = createTestConversation({
        phase: "plan",
        metadata: {
          plan_summary: "Test plan",
          architecture: "Test architecture", 
          tasks: ["Task 1", "Task 2"],
          plan_approved: true
        }
      });

      const result = evaluatePhaseCompletion("plan", conversation);
      
      expect(result.completed).toBe(true);
      expect(result.criteria.plan?.userApproval).toBe(true);
      expect(result.outcome).toBe("success");
    });

    it("should handle string 'true' for plan approval", () => {
      const conversation: Conversation = createTestConversation({
        phase: "plan",
        metadata: {
          plan_summary: "Test plan",
          plan_approved: "true"
        }
      });

      const result = evaluatePhaseCompletion("plan", conversation);
      
      expect(result.criteria.plan?.userApproval).toBe(true);
    });
  });

  describe("execute phase completion", () => {
    it("should require execute summary and branch", () => {
      const conversation: Conversation = createTestConversation({
        phase: "execute",
        metadata: {
          branch: "feature/test"
          // Missing execute_summary
        }
      });

      const result = evaluatePhaseCompletion("execute", conversation);
      
      expect(result.completed).toBe(false);
      expect(result.criteria.execute?.allTasksCompleted).toBe(false);
    });
  });
});