import { CreateProjectDialog } from "../dialogs/CreateProjectDialog";
import { GlobalSearchDialog } from "../dialogs/GlobalSearchDialog";

interface LayoutDialogsProps {
    // Dialog states
    showCreateDialog: boolean;
    showSearchDialog: boolean;

    // Dialog handlers
    onCreateDialogChange: (open: boolean) => void;
    onSearchDialogChange: (open: boolean) => void;
}

export function LayoutDialogs({
    showCreateDialog,
    showSearchDialog,
    onCreateDialogChange,
    onSearchDialogChange,
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
        </>
    );
}
