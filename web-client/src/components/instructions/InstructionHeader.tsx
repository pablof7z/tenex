import { Check, Copy, Edit, Save, X } from "lucide-react";
import type { NDKLLMRule } from "../../types/template";
import { Button } from "../ui/button";

interface InstructionHeaderProps {
    selectedInstruction: NDKLLMRule | null;
    isCreatingNew: boolean;
    isEditing: boolean;
    copiedId: string | null;
    formData: { title: string; content: string };
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onCopyId: () => void;
}

export function InstructionHeader({
    selectedInstruction,
    isCreatingNew,
    isEditing,
    copiedId,
    formData,
    onEdit,
    onCancel,
    onSave,
    onCopyId,
}: InstructionHeaderProps) {
    return (
        <div className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">
                        {isCreatingNew
                            ? "Create New Instruction"
                            : selectedInstruction?.title ||
                              selectedInstruction?.tagValue?.("title") ||
                              "Untitled Instruction"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {isCreatingNew
                            ? "Version 1"
                            : `Version ${selectedInstruction?.version || "1"}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="outline" size="sm" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={onSave}
                                disabled={!formData.title.trim() || !formData.content.trim()}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {isCreatingNew ? "Publish instruction" : "Publish new version"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={onEdit}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                            {selectedInstruction && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onCopyId}
                                    title="Copy instruction event ID"
                                >
                                    {copiedId === selectedInstruction.id ? (
                                        <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
