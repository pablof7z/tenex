import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "./providers";

/**
 * Custom render function that includes all providers
 */
export function renderWithProviders(
    ui: React.ReactElement,
    options?: RenderOptions & {
        ndk?: unknown;
        initialAtomValues?: Array<[unknown, unknown]>;
    }
) {
    const { ndk, initialAtomValues, ...renderOptions } = options || {};

    return {
        user: userEvent.setup(),
        ...render(ui, {
            wrapper: createWrapper({ ndk, initialAtomValues }),
            ...renderOptions,
        }),
    };
}

/**
 * Re-export everything from @testing-library/react
 */
export * from "@testing-library/react";
export { userEvent };
