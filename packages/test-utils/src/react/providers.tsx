import { Provider as JotaiProvider } from "jotai";
import { createStore } from "jotai";
import React from "react";
import type { ReactNode } from "react";
import { createMockNDK } from "../nostr/mocks";

interface TestProvidersProps {
    children: ReactNode;
    ndk?: unknown;
    initialAtomValues?: Array<[unknown, unknown]>;
}

/**
 * Wraps components with all necessary providers for testing
 */
export function TestProviders({
    children,
    ndk = createMockNDK(),
    initialAtomValues = [],
}: TestProvidersProps) {
    // ndk is used in the context below
    void ndk;
    const store = createStore();

    // Set initial atom values
    for (const [atom, value] of initialAtomValues) {
        store.set(atom, value);
    }

    return <JotaiProvider store={store}>{children}</JotaiProvider>;
}

/**
 * Creates a wrapper function for render methods
 */
export function createWrapper(options: Omit<TestProvidersProps, "children"> = {}) {
    return ({ children }: { children: ReactNode }) => (
        <TestProviders {...options}>{children}</TestProviders>
    );
}
