import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { EventMonitor } from "../../../src/core/EventMonitor";

// Mock dependencies
const mockNDKSubscription = {
    on: mock((_event: string, _handler: (event: NDKEvent) => void) => {}),
    stop: mock(() => {}),
};

const mockNDK = {
    subscribe: mock(() => mockNDKSubscription),
    connect: mock(() => Promise.resolve()),
    pool: {
        relays: new Map(),
    },
};

// No need to mock NDK constructor since we inject it

// Mock fs module
mock.module("node:fs/promises", () => ({
    access: mock(() => Promise.reject(new Error("Not found"))),
    writeFile: mock(() => Promise.resolve()),
}));

// Mock nostr-tools
mock.module("nostr-tools", () => ({
    nip19: {
        naddrEncode: mock(({ identifier, pubkey, kind }: any) => {
            return `naddr1_${kind}_${pubkey}_${identifier}`;
        }),
        decode: mock((naddr: string) => {
            const parts = naddr.split("_");
            return {
                type: "naddr",
                data: {
                    identifier: parts[3] || "test",
                    pubkey: parts[2] || "testpubkey",
                    kind: parseInt(parts[1] || "31933"),
                },
            };
        }),
    },
}));

mock.module("@tenex/shared", () => ({
    logger: {
        info: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
        debug: mock(() => {}),
    },
    getRelayUrls: mock(() => ["wss://relay.damus.io"]),
}));

describe("EventMonitor", () => {
    let eventMonitor: EventMonitor;
    let mockProjectManager: {
        ensureProjectExists: ReturnType<typeof mock>;
    };
    let mockProcessManager: {
        isProjectRunning: ReturnType<typeof mock>;
        spawnProjectRun: ReturnType<typeof mock>;
    };
    let eventHandlers: Map<string, (event: NDKEvent) => void>;

    beforeEach(() => {
        // Reset mocks
        mockNDKSubscription.on.mockClear();
        mockNDKSubscription.stop.mockClear();
        mockNDK.subscribe.mockClear();
        mockNDK.connect.mockClear();

        // Track event handlers
        eventHandlers = new Map();
        mockNDKSubscription.on = mock((event: string, handler: (event: NDKEvent) => void) => {
            eventHandlers.set(event, handler);
        });

        mockProjectManager = {
            ensureProjectExists: mock((identifier: string, _naddr: string, _ndk: any) => {
                return Promise.resolve(`/projects/${identifier}`);
            }),
        };

        mockProcessManager = {
            isProjectRunning: mock((projectId: string) => {
                const result = projectId === "already-running" ? true : false;
                return Promise.resolve(result);
            }),
            spawnProjectRun: mock(() => Promise.resolve()),
            stopAll: mock(() => Promise.resolve()),
        };

        eventMonitor = new EventMonitor(mockNDK as any, mockProjectManager, mockProcessManager);
    });

    describe("start", () => {
        test("should start monitoring with whitelisted pubkeys", async () => {
            const whitelistedPubkeys = ["pubkey1", "pubkey2", "pubkey3"];

            await eventMonitor.start(whitelistedPubkeys);

            // Verify NDK subscription was created with correct filter
            expect(mockNDK.subscribe).toHaveBeenCalledWith(
                {
                    authors: whitelistedPubkeys,
                    since: expect.any(Number),
                },
                {
                    closeOnEose: false,
                    groupable: false,
                }
            );

            // Verify event handler was registered
            expect(eventHandlers.has("event")).toBe(true);
        });

        test("should handle empty whitelist", async () => {
            await eventMonitor.start([]);

            expect(mockNDK.subscribe).toHaveBeenCalledWith(
                {
                    authors: [],
                    since: expect.any(Number),
                },
                expect.any(Object)
            );
        });
    });

    describe("stop", () => {
        test("should stop monitoring and clean up", async () => {
            await eventMonitor.start(["pubkey1"]);
            await eventMonitor.stop();

            expect(mockNDKSubscription.stop).toHaveBeenCalled();
        });

        test("should handle stop when not started", async () => {
            await eventMonitor.stop();

            expect(mockNDKSubscription.stop).not.toHaveBeenCalled();
        });
    });

    describe("event handling", () => {
        beforeEach(async () => {
            await eventMonitor.start(["pubkey1", "pubkey2"]);
        });

        test("should process project events from whitelisted pubkeys", async () => {
            // Create a proper mock event
            const event = {
                pubkey: "pubkey1",
                id: "event1",
                kind: 1,
                tags: [["a", "31933:pubkey1:test-project"]],
                content: "",
                created_at: Date.now(),
                sig: "",
            };

            const handler = eventHandlers.get("event");
            expect(handler).toBeDefined();
            
            // Call the handler with a mock event
            await handler(event as any);
            
            // Add small delay to ensure async operations complete
            await new Promise((resolve) => setTimeout(resolve, 10));
            
            expect(mockProjectManager.ensureProjectExists).toHaveBeenCalledWith(
                "test-project",
                expect.any(String),
                mockNDK
            );
            expect(mockProcessManager.spawnProjectRun).toHaveBeenCalledWith(
                "/projects/test-project",
                "test-project"
            );
        });

        test("should ignore events from non-whitelisted pubkeys", async () => {
            const event = {
                pubkey: "",
                id: "",
                kind: 1,
                tags: [],
                content: "",
                created_at: Date.now(),
                sig: "",
            };
            event.pubkey = "unknown-pubkey";
            event.tags = [["a", "31933:pubkey1:test-project"]];

            const handler = eventHandlers.get("event");
            if (handler) {
                await handler(event);
            }

            expect(mockProjectManager.ensureProjectExists).not.toHaveBeenCalled();
            expect(mockProcessManager.spawnProjectRun).not.toHaveBeenCalled();
        });

        test("should ignore events without project tag", async () => {
            const event = {
                pubkey: "",
                id: "",
                kind: 1,
                tags: [],
                content: "",
                created_at: Date.now(),
                sig: "",
            };
            event.pubkey = "pubkey1";
            event.tags = [["e", "some-event-id"]];

            const handler = eventHandlers.get("event");
            if (handler) {
                await handler(event);
            }

            expect(mockProjectManager.ensureProjectExists).not.toHaveBeenCalled();
            expect(mockProcessManager.spawnProjectRun).not.toHaveBeenCalled();
        });

        test("should not spawn if project is already running", async () => {
            mockProcessManager.isProjectRunning.mockImplementation(() => Promise.resolve(true));

            const event = {
                pubkey: "",
                id: "",
                kind: 1,
                tags: [],
                content: "",
                created_at: Date.now(),
                sig: "",
            };
            event.pubkey = "pubkey1";
            event.tags = [["a", "31933:pubkey1:test-project"]];

            const handler = eventHandlers.get("event");
            if (handler) {
                await handler(event);
            }

            expect(mockProcessManager.isProjectRunning).toHaveBeenCalledWith("test-project");
            expect(mockProcessManager.spawnProjectRun).not.toHaveBeenCalled();
        });

        test("should handle malformed project tags gracefully", async () => {
            const event = {
                pubkey: "",
                id: "",
                kind: 1,
                tags: [],
                content: "",
                created_at: Date.now(),
                sig: "",
            };
            event.pubkey = "pubkey1";
            event.tags = [["a", "invalid-format"]];

            const handler = eventHandlers.get("event");
            if (handler) {
                await handler(event);
            }

            expect(mockProjectManager.ensureProjectExists).not.toHaveBeenCalled();
        });

        test("should handle project initialization errors", async () => {
            mockProjectManager.ensureProjectExists = mock(() =>
                Promise.reject(new Error("Initialization failed"))
            );

            const event = {
                pubkey: "pubkey1",
                id: "event1",
                kind: 1,
                tags: [["a", "31933:pubkey1:test-project"]],
                content: "",
                created_at: Date.now(),
                sig: "",
            };

            const handler = eventHandlers.get("event");
            if (handler) {
                // Should not throw, error is caught internally
                await handler(event);
            }

            expect(mockProcessManager.spawnProjectRun).not.toHaveBeenCalled();
        });
    });

    describe("naddr reconstruction", () => {
        test("should correctly reconstruct naddr from project tag", async () => {
            await eventMonitor.start(["pubkey1"]);

            const event = {
                pubkey: "pubkey1",
                id: "event1",
                kind: 1,
                tags: [
                    [
                        "a",
                        "31933:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:test-identifier",
                    ],
                ],
                content: "",
                created_at: Date.now(),
                sig: "",
            };

            const handler = eventHandlers.get("event");
            if (handler) {
                await handler(event);
            }

            // Extract the naddr that was passed to ensureProjectExists
            const callArgs = mockProjectManager.ensureProjectExists.mock.calls[0];
            expect(callArgs).toBeDefined();
            if (callArgs) {
                const naddr = callArgs[1];
                // The naddr should be properly formatted with the expected values
                expect(naddr).toBe("naddr1_31933_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef_test-identifier");
            } else {
                expect(callArgs).toBeDefined();
            }
        });

        test("should use event pubkey if project tag has no pubkey", async () => {
            await eventMonitor.start([
                "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            ]);

            const event = {
                pubkey: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                id: "event1",
                kind: 1,
                tags: [["a", "31933::test-identifier"]],
                content: "",
                created_at: Date.now(),
                sig: "",
            };

            const handler = eventHandlers.get("event");
            if (handler) {
                await handler(event);
            }

            const callArgs = mockProjectManager.ensureProjectExists.mock.calls[0];
            expect(callArgs).toBeDefined();
            if (callArgs) {
                const naddr = callArgs[1];
                // Should use event pubkey when project tag has no pubkey part
                expect(naddr).toBe("naddr1_31933_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef_test-identifier");
            }
        });
    });
});
