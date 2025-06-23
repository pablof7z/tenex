/**
 * Nostr event kinds used in the E2E framework
 */
export const NostrEventKinds = {
  // Standard kinds
  NOTE: 1,              // Regular text note
  
  // Custom TENEX kinds
  PROJECT_EVENT: 30078, // Project event
  BUILD_REQUEST: 9000,  // Build mode request
  BUILD_STATUS: 9001,   // Build status update
  BUILD_RESULT: 9002,   // Build result/completion
} as const;

export type NostrEventKind = typeof NostrEventKinds[keyof typeof NostrEventKinds];