import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import type { ProjectAgent } from "../../hooks/useProjectAgents";
import { CreateProjectDialog } from "../dialogs/CreateProjectDialog";
import { CreateTaskDialog } from "../dialogs/CreateTaskDialog";
import { GlobalSearchDialog } from "../dialogs/GlobalSearchDialog";
import { TaskCreationOptionsDialog } from "../dialogs/TaskCreationOptionsDialog";
import { ThreadDialog } from "../dialogs/ThreadDialog";
import { VoiceTaskDialog } from "../dialogs/VoiceTaskDialog";

interface LayoutDialogsProps {
    // Dialog states
    showCreateDialog: boolean;
    showSearchDialog: boolean;
    showTaskOptionsDialog: boolean;
    showCreateTaskDialog: boolean;
    showVoiceTaskDialog: boolean;
    showThreadDialog: boolean;
    selectedProjectForTask: NDKProject | null;

    // Dialog handlers
    onCreateDialogChange: (open: boolean) => void;
    onSearchDialogChange: (open: boolean) => void;
    onTaskOptionsDialogChange: (open: boolean) => void;
    onCreateTaskDialogChange: (open: boolean) => void;
    onVoiceTaskDialogChange: (open: boolean) => void;
    onThreadDialogChange: (open: boolean) => void;

    // Event handlers
    onTaskOptionSelect: (option: "task" | "voice" | "thread") => void;
    onTaskCreated: () => void;
    onThreadStart: (title: string, selectedAgents: ProjectAgent[]) => void;
}

export function LayoutDialogs({
    showCreateDialog,
    showSearchDialog,
    showTaskOptionsDialog,
    showCreateTaskDialog,
    showVoiceTaskDialog,
    showThreadDialog,
    selectedProjectForTask,
    onCreateDialogChange,
    onSearchDialogChange,
    onTaskOptionsDialogChange,
    onCreateTaskDialogChange,
    onVoiceTaskDialogChange,
    onThreadDialogChange,
    onTaskOptionSelect,
    onTaskCreated,
    onThreadStart,
}: LayoutDialogsProps) {
    return (
        <>
            {/* Create Project Dialog */}
            <CreateProjectDialog
                open={showCreateDialog}
                onOpenChange={onCreateDialogChange}
                onProjectCreated={() => {
                    // Projects will automatically refresh via the useSubscribe hook
                }}
            />

            {/* Global Search Dialog */}
            <GlobalSearchDialog open={showSearchDialog} onOpenChange={onSearchDialogChange} />

            {/* Task Creation Options Dialog */}
            <TaskCreationOptionsDialog
                open={showTaskOptionsDialog}
                onOpenChange={onTaskOptionsDialogChange}
                onOptionSelect={onTaskOptionSelect}
            />

            {/* Create Task Dialog */}
            {selectedProjectForTask && (
                <CreateTaskDialog
                    open={showCreateTaskDialog}
                    onOpenChange={onCreateTaskDialogChange}
                    project={selectedProjectForTask}
                    onTaskCreated={onTaskCreated}
                />
            )}

            {/* Voice Task Dialog */}
            {selectedProjectForTask && (
                <VoiceTaskDialog
                    open={showVoiceTaskDialog}
                    onOpenChange={onVoiceTaskDialogChange}
                    project={selectedProjectForTask}
                    onTaskCreated={onTaskCreated}
                />
            )}

            {/* Thread Dialog */}
            {selectedProjectForTask && (
                <ThreadDialog
                    open={showThreadDialog}
                    onOpenChange={onThreadDialogChange}
                    project={selectedProjectForTask}
                    onThreadStart={onThreadStart}
                />
            )}
        </>
    );
}
