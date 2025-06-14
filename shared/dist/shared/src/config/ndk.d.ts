import NDK from "@nostr-dev-kit/ndk";
import type { Debugger } from "debug";
export interface NDKConfig {
    relays?: readonly string[];
    extended?: boolean;
    debug?: boolean | Debugger;
}
/**
 * Unified NDK setup pattern for TENEX
 * Replaces the 4 different NDK initialization patterns across the codebase
 */
export declare function getNDK(config?: NDKConfig): Promise<NDK>;
/**
 * Create a new NDK instance (not singleton)
 * Useful when you need a separate instance with different configuration
 */
export declare function createNDK(config?: NDKConfig): Promise<NDK>;
/**
 * Reset the singleton instance (useful for testing)
 */
export declare function resetNDK(): void;
//# sourceMappingURL=ndk.d.ts.map