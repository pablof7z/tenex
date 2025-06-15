import type { NDK, NDKEvent, NDKFilter, NDKSigner, NDKUser } from "@nostr-dev-kit/ndk";
import { vi } from "vitest";

/**
 * Creates a mock NDK instance with common methods stubbed
 */
export function createMockNDK(overrides: Partial<NDK> = {}): NDK {
    const mockNDK = {
        connect: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(new Set(["wss://relay1.test"])),
        subscribe: vi.fn().mockReturnValue({
            on: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            eose: vi.fn(),
        }),
        fetchEvents: vi.fn().mockResolvedValue(new Set()),
        fetchEvent: vi.fn().mockResolvedValue(null),
        getUser: vi.fn().mockReturnValue(createMockUser()),
        pool: {
            relays: new Map(),
            on: vi.fn(),
            addRelay: vi.fn(),
            removeRelay: vi.fn(),
        },
        ...overrides,
    } as unknown as NDK;

    return mockNDK;
}

/**
 * Creates a mock NDKEvent with sensible defaults
 */
export function createMockEvent(overrides: Partial<NDKEvent> = {}): NDKEvent {
    const mockEvent = {
        id: "test-event-id",
        pubkey: "test-pubkey",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test content",
        sig: "test-signature",
        publish: vi.fn().mockResolvedValue(new Set(["wss://relay1.test"])),
        sign: vi.fn().mockResolvedValue(undefined),
        tagValue: vi.fn().mockReturnValue(undefined),
        getMatchingTags: vi.fn().mockReturnValue([]),
        ...overrides,
    } as unknown as NDKEvent;

    return mockEvent;
}

/**
 * Creates a mock NDKUser
 */
export function createMockUser(overrides: Partial<NDKUser> = {}): NDKUser {
    const mockUser = {
        pubkey: "test-user-pubkey",
        npub: "npub1test...",
        profile: {
            name: "Test User",
            displayName: "Test User",
            about: "Test user bio",
            image: "https://example.com/avatar.jpg",
            nip05: "test@example.com",
        },
        fetchProfile: vi.fn().mockResolvedValue({
            name: "Test User",
            displayName: "Test User",
            about: "Test user bio",
            image: "https://example.com/avatar.jpg",
            nip05: "test@example.com",
        }),
        ...overrides,
    } as unknown as NDKUser;

    return mockUser;
}

/**
 * Creates a mock NDKSigner
 */
export function createMockSigner(overrides: Partial<NDKSigner> = {}): NDKSigner {
    const mockSigner = {
        user: vi.fn().mockResolvedValue(createMockUser()),
        sign: vi.fn().mockResolvedValue("mock-signature"),
        encrypt: vi.fn().mockResolvedValue("encrypted-content"),
        decrypt: vi.fn().mockResolvedValue("decrypted-content"),
        ...overrides,
    } as unknown as NDKSigner;

    return mockSigner;
}

/**
 * Creates a mock subscription
 */
export function createMockSubscription(events: NDKEvent[] = []) {
    const handlers: Record<string, Array<(...args: unknown[]) => unknown>> = {
        event: [],
        eose: [],
        close: [],
    };

    return {
        on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        }),
        start: vi.fn(() => {
            // Simulate events being received
            setTimeout(() => {
                for (const event of events) {
                    if (handlers.event) {
                        for (const handler of handlers.event) {
                            handler(event);
                        }
                    }
                }
                if (handlers.eose) {
                    for (const handler of handlers.eose) {
                        handler();
                    }
                }
            }, 10);
        }),
        stop: vi.fn(() => {
            if (handlers.close) {
                for (const handler of handlers.close) {
                    handler();
                }
            }
        }),
        eose: vi.fn(),
    };
}
