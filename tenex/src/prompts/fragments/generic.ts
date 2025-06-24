import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Base context fragment - sets the AI's role
interface BaseContextArgs {
    content: string;
}

export const baseContextFragment: PromptFragment<BaseContextArgs> = {
    id: "base-context",
    priority: 10,
    template: ({ content }) => content,
};

// Task description fragment
interface TaskDescriptionArgs {
    content: string;
}

export const taskDescriptionFragment: PromptFragment<TaskDescriptionArgs> = {
    id: "task-description",
    priority: 30,
    template: ({ content }) => content,
};

// Current state fragment
interface CurrentStateArgs {
    content: string;
}

export const currentStateFragment: PromptFragment<CurrentStateArgs> = {
    id: "current-state",
    priority: 20,
    template: ({ content }) => content,
};

// User context fragment
interface UserContextArgs {
    content: string;
}

export const userContextFragment: PromptFragment<UserContextArgs> = {
    id: "user-context",
    priority: 25,
    template: ({ content }) => content,
};

// History fragment
interface HistoryArgs {
    content: string;
}

export const historyFragment: PromptFragment<HistoryArgs> = {
    id: "history",
    priority: 35,
    template: ({ content }) => content,
};

// Completion criteria fragment
interface CompletionCriteriaArgs {
    content: string;
}

export const completionCriteriaFragment: PromptFragment<CompletionCriteriaArgs> = {
    id: "completion-criteria",
    priority: 45,
    template: ({ content }) => content,
};

// Error context fragment
interface ErrorContextArgs {
    content: string;
}

export const errorContextFragment: PromptFragment<ErrorContextArgs> = {
    id: "error-context",
    priority: 15,
    template: ({ content }) => content,
};

// Register all fragments
fragmentRegistry.register(baseContextFragment);
fragmentRegistry.register(taskDescriptionFragment);
fragmentRegistry.register(currentStateFragment);
fragmentRegistry.register(userContextFragment);
fragmentRegistry.register(historyFragment);
fragmentRegistry.register(completionCriteriaFragment);
fragmentRegistry.register(errorContextFragment);
