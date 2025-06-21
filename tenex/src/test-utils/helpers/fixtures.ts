import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/types/agent";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { createConversationEvent } from "../mocks/events";

export function createTestAgent(overrides: Partial<Agent> = {}): Agent {
  const signer = NDKPrivateKeySigner.generate();

  return {
    name: "TestAgent",
    pubkey: signer.pubkey,
    signer,
    role: "Test Role",
    expertise: "Testing",
    instructions: "You are a test agent",
    llmConfig: "default",
    tools: [],
    ...overrides,
  };
}

export function createTestConversation(
  overrides: Partial<ConversationState> = {}
): ConversationState {
  const event = createConversationEvent();

  return {
    id: event.id,
    title: "Test Conversation",
    phase: "chat",
    history: [event],
    currentAgent: undefined,
    phaseStartedAt: Date.now(),
    metadata: {},
    ...overrides,
  };
}

export function createTestProjectContext() {
  const projectSigner = NDKPrivateKeySigner.generate();
  const projectEvent = createConversationEvent("project-123", "Test Project", "Test Project");

  return {
    projectEvent,
    projectSigner,
    agents: new Map<string, Agent>(),
    projectPath: "/test/project",
    title: "Test Project",
    repository: undefined,
  };
}

export const TEST_NSEC = "nsec1test1234567890test1234567890test1234567890test12345";
export const TEST_PUBKEY = "pubkey1234567890";
export const TEST_PROJECT_PATH = "/test/project";
export const TEST_CONVERSATION_ID = "conversation-123";
export const TEST_AGENT_NAME = "TestAgent";
