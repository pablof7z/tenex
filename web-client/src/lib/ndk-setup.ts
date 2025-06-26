import { registerEventClass } from "@nostr-dev-kit/ndk-hooks";
import { NDKAgent, NDKAgentLesson } from "@tenex/cli/events";

// Register the NDKAgent custom event class with NDK
registerEventClass(NDKAgent);
registerEventClass(NDKAgentLesson);

export { NDKAgent, NDKAgentLesson };
