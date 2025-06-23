import { describe, it, expect } from "bun:test";
import { meetsPhaseTransitionCriteria } from "../routingDomain";
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

describe("meetsPhaseTransitionCriteria", () => {
  describe("with new phase completion logic", () => {
    it("should not allow plan->execute transition without plan approval", () => {
      const conversation = createTestConversation({
        phase: "plan",
        metadata: {
          plan_summary: "Test plan",
          architecture: "Test architecture",
          // Missing plan_approved
        }
      });

      const result = meetsPhaseTransitionCriteria(conversation, "execute");
      
      expect(result.canTransition).toBe(false);
      expect(result.reason).toContain("user approval not obtained");
    });

    it("should allow plan->execute transition with plan approval", () => {
      const conversation = createTestConversation({
        phase: "plan",
        metadata: {
          plan_summary: "Test plan",
          plan_approved: true
        }
      });

      const result = meetsPhaseTransitionCriteria(conversation, "execute");
      
      expect(result.canTransition).toBe(true);
      expect(result.reason).toContain("plan phase complete");
    });

    it("should not allow chat->plan transition without requirements", () => {
      const conversation = createTestConversation({
        phase: "chat",
        history: [], // No user messages
        metadata: {} // No requirements
      });

      const result = meetsPhaseTransitionCriteria(conversation, "plan");
      
      expect(result.canTransition).toBe(false);
      expect(result.reason).toContain("requirements not captured");
    });

    it("should allow execute->review transition with execute summary", () => {
      const conversation = createTestConversation({
        phase: "execute",
        metadata: {
          execute_summary: "Implementation complete",
          branch: "feature/test"
        }
      });

      const result = meetsPhaseTransitionCriteria(conversation, "review");
      
      expect(result.canTransition).toBe(true);
      expect(result.reason).toContain("execute phase complete");
    });

    it("should always allow going back to chat phase", () => {
      const conversation = createTestConversation({
        phase: "execute",
        metadata: {} // No completion criteria met
      });

      const result = meetsPhaseTransitionCriteria(conversation, "chat");
      
      expect(result.canTransition).toBe(true);
      expect(result.reason).toContain("Returning to chat");
    });

    it("should reject invalid phase transitions", () => {
      const conversation = createTestConversation({
        phase: "chat",
        metadata: {}
      });

      const result = meetsPhaseTransitionCriteria(conversation, "execute");
      
      expect(result.canTransition).toBe(false);
      expect(result.reason).toContain("No valid transition path");
    });
  });
});