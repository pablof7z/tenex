import type { Phase } from "@/types/conversation";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { MockNDKEvent } from "./ndk";

export function createConversationEvent(
  id = `conv-${Date.now()}`,
  content = "Test conversation",
  title = "Test Conversation"
): MockNDKEvent {
  return new MockNDKEvent(undefined, {
    id,
    kind: 11,
    content,
    tags: [
      ["title", title],
      ["a", "35523:test-project-pubkey:test-project"],
    ],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: "test-user-pubkey",
  });
}

export function createReplyEvent(
  conversationId: string,
  content = "Test reply",
  author = "test-user-pubkey"
): MockNDKEvent {
  return new MockNDKEvent(undefined, {
    id: `reply-${Date.now()}`,
    kind: 1,
    content,
    tags: [
      ["E", conversationId, "", "root"],
      ["e", conversationId],
    ],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: author,
  });
}

export function createAgentMessageEvent(
  conversationId: string,
  agentPubkey: string,
  content: string,
  phase: Phase = "chat"
): MockNDKEvent {
  return new MockNDKEvent(undefined, {
    id: `agent-msg-${Date.now()}`,
    kind: 1,
    content,
    tags: [
      ["E", conversationId, "", "root"],
      ["e", conversationId],
      ["phase", phase],
      ["role", "agent"],
    ],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: agentPubkey,
  });
}

export function createProjectEvent(
  projectId = "test-project",
  title = "Test Project",
  agentEventIds: string[] = []
): MockNDKEvent {
  const tags = [
    ["d", projectId],
    ["title", title],
    ["name", projectId],
  ];

  for (const id of agentEventIds) {
    tags.push(["agent", id]);
  }

  return new MockNDKEvent(undefined, {
    id: `project-${Date.now()}`,
    kind: 35523,
    content: "Test project description",
    tags,
    created_at: Math.floor(Date.now() / 1000),
    pubkey: "test-project-pubkey",
  });
}

export function createAgentConfigEvent(
  agentName: string,
  role = "Test Role",
  instructions = "Test instructions"
): MockNDKEvent {
  return new MockNDKEvent(undefined, {
    id: `agent-config-${Date.now()}`,
    kind: 35524,
    content: JSON.stringify({
      name: agentName,
      role,
      instructions,
    }),
    tags: [
      ["title", agentName],
      ["role", role],
      ["instructions", instructions],
      ["version", "1"],
    ],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: "test-agent-creator",
  });
}
