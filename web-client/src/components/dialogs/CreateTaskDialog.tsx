import { type NDKProject, NDKTask, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useEffect } from "react";
import { useFormDialogState } from "../../hooks/useDialogState";
import { FormDialog } from "../common/FormDialog";
import { Input } from "../ui/input";

interface CreateTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: NDKProject;
    onTaskCreated?: () => void;
    initialTitle?: string;
    initialDescription?: string;
}

interface TaskFormData extends Record<string, unknown> {
    title: string;
    description: string;
}

export function CreateTaskDialog({
    open,
    onOpenChange,
    project,
    onTaskCreated,
    initialTitle,
    initialDescription,
}: CreateTaskDialogProps) {
    const { ndk } = useNDK();
    const {
        data,
        isLoading,
        setIsLoading,
        updateField,
        reset,
        handleFieldChange,
        validationErrors,
        validateField,
    } = useFormDialogState<TaskFormData>({
        title: "",
        description: "",
    });

    // Set initial values when dialog opens or initial values change
    useEffect(() => {
        if (open && initialTitle !== undefined) {
            updateField("title", initialTitle);
        }
        if (open && initialDescription !== undefined) {
            updateField("description", initialDescription);
        }
    }, [open, initialTitle, initialDescription, updateField]);

    const handleCreate = async () => {
        // Validate fields
        const titleValid = validateField("title", (value) =>
            (value as string).trim() ? null : "Title is required"
        );
        const descriptionValid = validateField("description", (value) =>
            (value as string).trim() ? null : "Description is required"
        );

        if (!titleValid || !descriptionValid) {
            return;
        }

        setIsLoading(true);
        try {
            if (!ndk) throw new Error("NDK not available");

            const task = new NDKTask(ndk);
            task.title = data.title.trim();
            task.content = data.description.trim();

            // Tag the task with the project
            task.tags.push(["a", project.tagId()]);

            task.publish();

            reset();
            onTaskCreated?.();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to create task:", error);
            alert("Failed to create task. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        reset();
    };

    const canSubmit = Boolean(data.title.trim() && data.description.trim());

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title="New Task"
            isLoading={isLoading}
            canSubmit={canSubmit}
            submitLabel="Create Task"
            onSubmit={handleCreate}
            onCancel={handleClose}
            maxWidth="md"
        >
            <div className="space-y-2">
                <label htmlFor="task-title" className="block text-sm font-medium text-slate-700">
                    Title
                </label>
                <Input
                    id="task-title"
                    placeholder="Enter task title..."
                    value={data.title}
                    onChange={handleFieldChange("title")}
                    disabled={isLoading}
                />
                {validationErrors.title && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.title}</p>
                )}
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="task-description"
                    className="block text-sm font-medium text-slate-700"
                >
                    Description
                </label>
                <textarea
                    id="task-description"
                    placeholder="Enter task description..."
                    value={data.description}
                    onChange={handleFieldChange("description")}
                    disabled={isLoading}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {validationErrors.description && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.description}</p>
                )}
            </div>
        </FormDialog>
    );
}
