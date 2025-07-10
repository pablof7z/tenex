import { Server } from "lucide-react";
import { NDKMCPTool } from "@tenex/cli/events";
import { MCPToolForm } from "./MCPToolForm";
import { MCPToolHeader } from "./MCPToolHeader";
import { EmptyToolState } from "./EmptyToolState";

interface MCPToolMainContentProps {
    selectedTool: NDKMCPTool | null;
    isCreatingNew: boolean;
    isEditing: boolean;
    copiedId: string | null;
    formData: any;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onCopyToolId: (tool: NDKMCPTool) => void;
    onDeleteTool: (tool: NDKMCPTool) => void;
    onFormChange: (field: string, value: any) => void;
    onAddTag: () => void;
    onRemoveTag: (tag: string) => void;
}

export function MCPToolMainContent({
    selectedTool,
    isCreatingNew,
    isEditing,
    copiedId,
    formData,
    onEdit,
    onCancel,
    onSave,
    onCopyToolId,
    onDeleteTool,
    onFormChange,
    onAddTag,
    onRemoveTag,
}: MCPToolMainContentProps) {
    const showForm = isEditing || isCreatingNew;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {selectedTool || isCreatingNew ? (
                <>
                    <MCPToolHeader
                        tool={selectedTool}
                        isCreatingNew={isCreatingNew}
                        isEditing={isEditing}
                        copiedId={copiedId}
                        onEdit={onEdit}
                        onCancel={onCancel}
                        onSave={onSave}
                        onCopyToolId={onCopyToolId}
                        onDeleteTool={onDeleteTool}
                    />

                    <div className="flex-1 overflow-y-auto">
                        {showForm ? (
                            <MCPToolForm
                                formData={formData}
                                onFormChange={onFormChange}
                                onAddTag={onAddTag}
                                onRemoveTag={onRemoveTag}
                            />
                        ) : (
                            <div className="p-6">
                                <div className="prose dark:prose-invert max-w-none">
                                    <h2>{selectedTool?.name}</h2>
                                    <p>{selectedTool?.description}</p>
                                    {selectedTool?.command && (
                                        <pre>
                                            <code>{selectedTool.command}</code>
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <EmptyToolState />
            )}
        </div>
    );
}