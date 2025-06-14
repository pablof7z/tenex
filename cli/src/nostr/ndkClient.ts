/**
 * TENEX CLI: NDK Utilities
 * Provides singleton NDK instance management
 */
import { getNDK as getSharedNDK } from "@tenex/shared/node";

export async function getNDK() {
    return await getSharedNDK();
}

export async function shutdownNDK(): Promise<void> {
    // The shared NDK instance handles shutdown
    // This is kept for backward compatibility but delegates to shared implementation
}
