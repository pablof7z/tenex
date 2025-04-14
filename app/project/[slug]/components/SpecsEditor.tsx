import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Undo2, Wand2 } from "lucide-react";

interface SpecsEditorProps {
    editorContent: string;
    selectedFileName: string;
    selectedGroup: "specs" | "rules";
    onContentChange: (content: string) => void;
    onSave: () => void;
    onImproveSpec: () => void;
    onUndoImprovement: () => void;
    isSaving: boolean;
    isEditorLoading: boolean; // AI loading
    isAiContent: boolean;
    previousEditorContent: string | null;
    isConfigReady: boolean;
    configError: string | null;
    isLoadingFiles: boolean; // Initial file loading
    filesError: string | null; // File-specific errors (e.g., save failed)
}

const DEFAULT_SPEC_FILENAME = "SPEC.md"; // Keep consistent

export function SpecsEditor({
    editorContent,
    selectedFileName,
    selectedGroup,
    onContentChange,
    onSave,
    onImproveSpec,
    onUndoImprovement,
    isSaving,
    isEditorLoading,
    isAiContent,
    previousEditorContent,
    isConfigReady,
    configError,
    isLoadingFiles,
    filesError,
}: SpecsEditorProps) {
    const actionsDisabled = !isConfigReady || isSaving || isEditorLoading || isLoadingFiles;
    const configErrorTooltip = configError
        ? `Configuration Error: ${configError}`
        : !isConfigReady
          ? "Loading configuration..."
          : "";

    const isSpecMd = selectedGroup === "specs" && selectedFileName === DEFAULT_SPEC_FILENAME;
    const saveButtonText = isSaving ? "Saving..." : `Save ${selectedFileName || "File"}`;

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-end space-x-2 flex-shrink-0">
                {/* Save Button */}
                <Button
                    onClick={onSave}
                    disabled={actionsDisabled}
                    size="sm"
                    title={configErrorTooltip || ""}
                >
                    {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {saveButtonText}
                </Button>
                {/* AI Buttons (Only for SPEC.md) */}
                {isSpecMd && (
                    <>
                        {isAiContent && !isEditorLoading && previousEditorContent !== null && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onUndoImprovement}
                                disabled={actionsDisabled}
                            >
                                <Undo2 className="mr-2 h-4 w-4" />
                                Undo AI
                            </Button>
                        )}
                        <Button
                            onClick={onImproveSpec}
                            disabled={actionsDisabled}
                            size="sm"
                            title={configErrorTooltip || ""}
                        >
                            {isEditorLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Wand2 className="mr-2 h-4 w-4" />
                            )}
                            Improve with AI
                        </Button>
                    </>
                )}
            </div>
            <Textarea
                value={editorContent}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={
                    !isConfigReady
                        ? "Configuration not ready..."
                        : isLoadingFiles
                          ? "Loading file content..."
                          : selectedFileName
                            ? `Content for ${selectedFileName}...`
                            : "Select a file to edit..." // Placeholder if no file selected
                }
                className="min-h-[500px] font-mono rounded-md border-border focus-visible:ring-ring flex-grow" // Use flex-grow
                disabled={actionsDisabled || !selectedFileName} // Also disable if no file selected
            />
            {/* Display file-specific error */}
            {filesError && <p className="text-sm text-destructive flex-shrink-0">{filesError}</p>}
        </div>
    );
}