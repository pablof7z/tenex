import { NDKKind, NDKProject, NDKTask } from "@nostr-dev-kit/ndk";
import { NDKAgent } from "@tenex/cli/events";

export const EVENT_KINDS = {
  METADATA: 0,
  GENERIC_REPLY: NDKKind.GenericReply,
  PROJECT: NDKProject.kind,
  AGENT_CONFIG: NDKAgent.kind,
  TASK: NDKTask.kind,
  PROJECT_STATUS: 24010,
  AGENT_REQUEST: 4133,
  AGENT_REQUEST_LIST: 4134,
  AGENT_LESSON: 4135,
  CHAT: 1111,
  ARTICLE: 30023,
  LLM_CONFIG_CHANGE: 24020,
  TYPING_INDICATOR: 24111,
  TYPING_INDICATOR_STOP: 24112,
} as const;