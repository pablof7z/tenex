/**
 * TENEX CLI: NDK Client (Refactored)
 * Only keep actual useful utilities here. All NDK setup is in session.ts.
 */

/**
 * Set the active signer for the NDK instance.
 */
export function setSigner(newSigner: NDKSigner): void {
    getNDKInstance(newSigner);
}

/**
 * Publish an event to Nostr using NDK best practices.
 * This does NOT await the publish (optimistic update).
 */

/**
 * Publish a status update (kind 1) with optional context tags.
 */
export function publishStatusUpdate(message: string, context?: Record<string, string | number | boolean>): void {
    const instance = getNDKInstance();
    const event = new NDKEvent(instance);
    event.kind = 1; // text note
    event.content = message;
    event.tags = [];

    if (context) {
        for (const [key, value] of Object.entries(context)) {
            event.tags.push([key, String(value)]);
        }
    }

    event.publish();
}