import { expect } from "bun:test";
import type { ConversationState } from "@/conversations/types";
import type { LLMResponse } from "@/llm/types";
import type { Agent } from "@/types/agent";

export function assertConversationState(
  conversation: ConversationState,
  expected: Partial<ConversationState>
): void {
  if (expected.id !== undefined) {
    expect(conversation.id).toBe(expected.id);
  }
  if (expected.title !== undefined) {
    expect(conversation.title).toBe(expected.title);
  }
  if (expected.phase !== undefined) {
    expect(conversation.phase).toBe(expected.phase);
  }
  if (expected.currentAgent !== undefined) {
    expect(conversation.currentAgent).toBe(expected.currentAgent);
  }
  if (expected.history !== undefined) {
    expect(conversation.history).toHaveLength(expected.history.length);
  }
}

export function assertAgent(agent: Agent, expected: Partial<Agent>): void {
  if (expected.name !== undefined) {
    expect(agent.name).toBe(expected.name);
  }
  if (expected.role !== undefined) {
    expect(agent.role).toBe(expected.role);
  }
  if (expected.expertise !== undefined) {
    expect(agent.expertise).toBe(expected.expertise);
  }
  if (expected.pubkey !== undefined) {
    expect(agent.pubkey).toBe(expected.pubkey);
  }
  if (expected.tools !== undefined) {
    expect(agent.tools).toEqual(expected.tools);
  }
}

export function assertLLMResponse(response: LLMResponse, expected: Partial<LLMResponse>): void {
  if (expected.content !== undefined) {
    expect(response.content).toBe(expected.content);
  }
  if (expected.model !== undefined) {
    expect(response.model).toBe(expected.model);
  }
  if (expected.usage !== undefined) {
    expect(response.usage).toEqual(expected.usage);
  }
}

export function assertContains(actual: string, expected: string): void {
  expect(actual).toContain(expected);
}

export function assertNotContains(actual: string, unexpected: string): void {
  expect(actual).not.toContain(unexpected);
}

export function assertArrayContains<T>(array: T[], predicate: (item: T) => boolean): void {
  const found = array.some(predicate);
  expect(found).toBe(true);
}

export function assertArrayNotContains<T>(array: T[], predicate: (item: T) => boolean): void {
  const found = array.some(predicate);
  expect(found).toBe(false);
}
