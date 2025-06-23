import { registerEventClass } from "@nostr-dev-kit/ndk";
import { NDKAgent } from "@tenex/cli/events";

// Register the NDKAgent custom event class with NDK
registerEventClass(NDKAgent);

export { NDKAgent };
