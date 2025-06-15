import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useCallback } from "react";
import { NDKAgent } from "../lib/ndk-setup";
import { type FormValidators, useFormDialogState } from "./useDialogState";

interface AgentFormData extends Record<string, unknown> {
    title: string;
    description: string;
    role: string;
    instructions: string;
    tags: string[];
    newTag: string;
}

const initialFormData: AgentFormData = {
    title: "",
    description: "",
    role: "",
    instructions: "",
    tags: [],
    newTag: "",
};

const validators: FormValidators<AgentFormData> = {
    title: (value) => (typeof value === "string" && !value.trim() ? "Title is required" : null),
    description: (value) =>
        typeof value === "string" && !value.trim() ? "Description is required" : null,
    role: (value) => (typeof value === "string" && !value.trim() ? "Role is required" : null),
    instructions: (value) =>
        typeof value === "string" && !value.trim() ? "Instructions are required" : null,
};

export function useAgentForm() {
    const { ndk } = useNDK();
    const formState = useFormDialogState<AgentFormData>(initialFormData);

    const loadAgent = useCallback(
        (agent: NDKAgent) => {
            const agentTags = agent.tags
                .filter((tag) => tag[0] === "t" && tag[1])
                .map((tag) => tag[1] as string);

            formState.loadData({
                title: agent.title || "",
                description:
                    agent.description || extractDescriptionFromContent(agent.content || ""),
                role: agent.role || extractRoleFromContent(agent.content || ""),
                instructions: agent.content || "",
                tags: agentTags,
                newTag: "",
            });
        },
        [formState]
    );

    const validateForm = useCallback((): boolean => {
        return formState.validateAllFields(validators);
    }, [formState]);

    const saveAgent = useCallback(
        async (selectedAgent: NDKAgent | null, isCreatingNew: boolean): Promise<boolean> => {
            if (!ndk || !validateForm()) return false;

            const newAgent = new NDKAgent(ndk);

            // Use NDKAgent accessor properties instead of manual tag creation
            newAgent.title = formState.data.title;
            newAgent.description = formState.data.description;
            newAgent.role = formState.data.role;
            newAgent.content = formState.data.instructions;

            // Add technology tags
            for (const tag of formState.data.tags) {
                newAgent.tags.push(["t", tag]);
            }

            if (!isCreatingNew && selectedAgent) {
                // When editing, increment version
                const currentVersion = selectedAgent.tagValue("ver") || "1";
                const newVersion = String(Number.parseInt(currentVersion) + 1);
                newAgent.tags.push(["ver", newVersion]);
            } else {
                // New agent starts at version 1
                newAgent.tags.push(["ver", "1"]);
            }

            try {
                await newAgent.publish();
                return true;
            } catch (error) {
                console.error("Failed to publish agent:", error);
                return false;
            }
        },
        [ndk, formState.data, validateForm]
    );

    const addTag = useCallback(() => {
        const newTag = formState.data.newTag.trim();
        if (newTag && !formState.data.tags.includes(newTag)) {
            formState.addToArrayField("tags", newTag);
            formState.updateField("newTag", "");
        }
    }, [formState]);

    const removeTag = useCallback(
        (tagToRemove: string) => {
            formState.removeFromArrayFieldByValue("tags", tagToRemove);
        },
        [formState]
    );

    return {
        // Expose form state
        ...formState,
        formData: formState.data, // Keep legacy formData property for compatibility

        // Custom agent methods
        loadAgent,
        saveAgent,
        validateForm,
        addTag,
        removeTag,
    };
}

function extractDescriptionFromContent(content: string): string {
    const lines = content.split("\n");
    const descIndex = lines.findIndex((line) => line.toLowerCase().includes("description"));
    if (descIndex >= 0 && descIndex < lines.length - 1) {
        return lines[descIndex + 1]?.trim() || "";
    }
    return "";
}

function extractRoleFromContent(content: string): string {
    const lines = content.split("\n");
    const roleIndex = lines.findIndex((line) => line.toLowerCase().includes("role"));
    if (roleIndex >= 0 && roleIndex < lines.length - 1) {
        return lines[roleIndex + 1]?.trim() || "";
    }
    return "";
}
