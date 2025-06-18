import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import type { ProjectAgent } from "../../hooks/useProjectAgents";
import { CreateProjectDialog } from "../dialogs/CreateProjectDialog";
import { GlobalSearchDialog } from "../dialogs/GlobalSearchDialog";
import { TaskCreationOptionsDialog } from "../dialogs/TaskCreationOptionsDialog";
import { ThreadDialog } from "../dialogs/ThreadDialog";
import { VoiceMessageDialog } from "../dialogs/VoiceMessageDialog";

interface LayoutDialogsProps {
    // Dialog states
    showCreateDialog: boolean;
    showSearchDialog: boolean;
    showOptionsDialog: boolean;
    showVoiceDialog: boolean;
    showThreadDialog: boolean;
    selectedProjectForTask: NDKProject | null;

    // Dialog handlers
    onCreateDialogChange: (open: boolean) => void;
    onSearchDialogChange: (open: boolean) => void;
    onOptionsDialogChange: (open: boolean) => void;
    onVoiceDialogChange: (open: boolean) => void;
    onThreadDialogChange: (open: boolean) => void;

    // Event handlers
    onOptionSelect: (option: "voice" | "thread") => void;
    onThreadStart: (title: string, selectedAgents: ProjectAgent[]) => void;
}

export function LayoutDialogs({
    showCreateDialog,
    showSearchDialog,
    showOptionsDialog,
    showVoiceDialog,
    showThreadDialog,
    selectedProjectForTask,
    onCreateDialogChange,
    onSearchDialogChange,
    onOptionsDialogChange,
    onVoiceDialogChange,
    onThreadDialogChange,
    onOptionSelect,
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

            {/* Creation Options Dialog */}
            <TaskCreationOptionsDialog
                open={showOptionsDialog}
                onOpenChange={onOptionsDialogChange}
                onOptionSelect={onOptionSelect}
            />

            {/* Voice Message Dialog */}
            {selectedProjectForTask && (
                <VoiceMessageDialog
                    open={showVoiceDialog}
                    onOpenChange={onVoiceDialogChange}
                    project={selectedProjectForTask}
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
