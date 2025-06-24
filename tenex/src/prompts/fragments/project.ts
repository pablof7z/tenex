import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Project inventory context fragment
interface InventoryContextArgs {
    hasInventory: boolean;
}

export const inventoryContextFragment: PromptFragment<InventoryContextArgs> = {
    id: "project-inventory-context",
    priority: 25,
    template: ({ hasInventory }) => {
        if (hasInventory) {
            return `## Project Context
A project inventory is available for this project. The inventory contains detailed information about the project structure, files, and dependencies that can help you understand the codebase better.

You can use the 'project-inventory' tool to access this information when needed.`;
        }

        return `## Project Context
No project inventory is available yet. An inventory can be generated to provide detailed information about the project structure, files, and dependencies.`;
    },
    validateArgs: (args): args is InventoryContextArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            typeof (args as InventoryContextArgs).hasInventory === "boolean"
        );
    },
};

// Register fragments
fragmentRegistry.register(inventoryContextFragment);