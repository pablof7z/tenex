import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useCallback } from "react";
import { NDKMCPTool } from "@tenex/cli/events";
import { type FormValidators, useFormDialogState } from "./useDialogState";

interface MCPToolFormData extends Record<string, unknown> {
    title: string;
    description: string;
    command: string;
    image: string;
    tags: string[];
    newTag: string;
}

const initialFormData: MCPToolFormData = {
    title: "",
    description: "",
    command: "",
    image: "",
    tags: [],
    newTag: "",
};

const validators: FormValidators<MCPToolFormData> = {
    title: (value) => (typeof value === "string" && !value.trim() ? "Title is required" : null),
    description: (value) =>
        typeof value === "string" && !value.trim() ? "Description is required" : null,
    command: (value) => (typeof value === "string" && !value.trim() ? "Command is required" : null),
};

export function useMCPToolForm() {
    const { ndk } = useNDK();
    const formState = useFormDialogState<MCPToolFormData>(initialFormData);

    const loadMCPTool = useCallback(
        (tool: NDKMCPTool) => {
            const toolTags = tool.tags
                .filter((tag) => tag[0] === "t" && tag[1])
                .map((tag) => tag[1] as string);

            formState.loadData({
                title: tool.name || "",
                description: tool.description || "",
                command: tool.command || "",
                image: tool.image || "",
                tags: toolTags,
                newTag: "",
            });
        },
        [formState]
    );

    const validateForm = useCallback((): boolean => {
        return formState.validateAllFields(validators);
    }, [formState]);

    const saveMCPTool = useCallback(
        async (selectedTool: NDKMCPTool | null, isCreatingNew: boolean): Promise<boolean> => {
            if (!ndk || !validateForm()) return false;

            const newTool = new NDKMCPTool(ndk);

            // Use NDKMCPTool accessor properties
            newTool.name = formState.data.title;
            newTool.description = formState.data.description;
            newTool.command = formState.data.command;
            
            if (formState.data.image) {
                newTool.image = formState.data.image;
            }

            // Add technology tags
            for (const tag of formState.data.tags) {
                newTool.tags.push(["t", tag]);
            }

            try {
                await newTool.publish();
                return true;
            } catch (_error) {
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

        // Custom MCP tool methods
        loadMCPTool,
        saveMCPTool,
        validateForm,
        addTag,
        removeTag,
    };
}