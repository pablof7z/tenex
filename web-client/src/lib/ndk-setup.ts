import { registerEventClass } from "@nostr-dev-kit/ndk-hooks";
import { NDKAgent, NDKAgentLesson, NDKMCPTool } from "@tenex/cli/events";

// Register the custom event classes with NDK
registerEventClass(NDKAgent);
registerEventClass(NDKAgentLesson);
registerEventClass(NDKMCPTool);

export { NDKAgent, NDKAgentLesson, NDKMCPTool };
