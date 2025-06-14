import { renderHook, type RenderHookOptions } from "@testing-library/react";
import { createWrapper } from "./providers";

/**
 * Renders a hook with all necessary providers
 */
export function renderHookWithProviders<TProps, TResult>(
    hook: (props: TProps) => TResult,
    options?: RenderHookOptions<TProps> & {
        ndk?: unknown;
        initialAtomValues?: Array<[unknown, unknown]>;
    }
) {
    const { ndk, initialAtomValues, ...renderOptions } = options || {};

    return renderHook(hook, {
        wrapper: createWrapper({ ndk, initialAtomValues }),
        ...renderOptions,
    });
}

/**
 * Common test scenarios for hooks
 */
export const hookTestScenarios = {
    /**
     * Tests loading states
     */
    async testLoadingStates(result: { current: unknown; waitForNextUpdate: () => Promise<void> }, expectedStates: unknown[]) {
        const states: unknown[] = [];

        // Capture initial state
        states.push(result.current);

        // Wait for updates
        for (let i = 1; i < expectedStates.length; i++) {
            await result.waitForNextUpdate();
            states.push(result.current);
        }

        // Compare states
        expect(states).toEqual(expectedStates);
    },

    /**
     * Tests error handling
     */
    async testErrorHandling(
        result: { current: unknown; waitForNextUpdate: () => Promise<void> },
        triggerError: () => void | Promise<void>,
        expectedError: unknown
    ) {
        await triggerError();
        await result.waitForNextUpdate();

        expect(result.current.error).toEqual(expectedError);
        expect(result.current.loading).toBe(false);
    },
};
