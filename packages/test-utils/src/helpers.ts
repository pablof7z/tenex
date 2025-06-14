import { vi } from "vitest";

/**
 * Sets up common test environment
 */
export function setupTestEnvironment() {
    // Mock console methods to reduce noise in tests
    const originalConsole = { ...console };

    beforeAll(() => {
        console.log = vi.fn();
        console.info = vi.fn();
        console.warn = vi.fn();
        console.error = vi.fn();
    });

    afterAll(() => {
        console.log = originalConsole.log;
        console.info = originalConsole.info;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
    });

    // Clear all mocks between tests
    afterEach(() => {
        vi.clearAllMocks();
    });
}

/**
 * Creates a test context with common utilities
 */
export function createTestContext() {
    return {
        // Track async operations
        pendingOperations: new Set<Promise<unknown>>(),

        // Wait for all pending operations
        async waitForPending() {
            await Promise.all(this.pendingOperations);
            this.pendingOperations.clear();
        },

        // Track an async operation
        trackAsync<T>(promise: Promise<T>): Promise<T> {
            this.pendingOperations.add(promise);
            promise.finally(() => this.pendingOperations.delete(promise));
            return promise;
        },
    };
}

/**
 * Asserts that a promise rejects with a specific error
 */
export async function expectToReject(
    promise: Promise<unknown>,
    expectedError?: string | RegExp | Error
): Promise<void> {
    try {
        await promise;
        throw new Error("Expected promise to reject, but it resolved");
    } catch (error) {
        if (expectedError) {
            if (typeof expectedError === "string") {
                expect(error).toEqual(new Error(expectedError));
            } else if (expectedError instanceof RegExp) {
                expect(error.message).toMatch(expectedError);
            } else {
                expect(error).toEqual(expectedError);
            }
        }
    }
}

/**
 * Creates a deferred promise for testing async flows
 */
export function createDeferred<T>() {
    let resolve: (value: T) => void;
    let reject: (error: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Flushes all pending promises
 */
export async function flushPromises(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Creates a test file system structure in memory
 */
export function createTestFileSystem() {
    const files = new Map<string, string>();

    return {
        files,

        async readFile(path: string): Promise<string> {
            const content = files.get(path);
            if (!content) throw new Error(`File not found: ${path}`);
            return content;
        },

        async writeFile(path: string, content: string): Promise<void> {
            files.set(path, content);
        },

        async exists(path: string): Promise<boolean> {
            return files.has(path);
        },

        async mkdir(path: string): Promise<void> {
            // Simplified - just track that directory was created
            files.set(`${path}/`, "");
        },

        reset() {
            files.clear();
        },
    };
}
