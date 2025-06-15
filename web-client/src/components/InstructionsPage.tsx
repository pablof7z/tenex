import type { NDKKind } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { FileText } from "lucide-react";
import { useEffect } from "react";
import { useInstructionActions } from "../hooks/useInstructionActions";
import { useInstructionForm } from "../hooks/useInstructionForm";
import { useInstructionSelection } from "../hooks/useInstructionSelection";
import type { NDKLLMRule } from "../types/template";
import { InstructionDetail } from "./instructions/InstructionDetail";
import { InstructionForm } from "./instructions/InstructionForm";
import { InstructionHeader } from "./instructions/InstructionHeader";
import { InstructionsList } from "./instructions/InstructionsList";

interface InstructionsPageProps {
    onBack: () => void;
}

export function InstructionsPage({ onBack }: InstructionsPageProps) {
    // Custom hooks for state management
    const {
        selectedInstruction,
        isEditing,
        isCreatingNew,
        selectInstruction,
        startCreatingNew,
        startEditing,
        cancelEditing,
    } = useInstructionSelection();

    const { formData, updateField, addTag, removeTag, resetForm, validateForm, setFormData } =
        useInstructionForm();

    const { saveInstruction, copyInstructionId, copiedId } = useInstructionActions();

    // Fetch instruction events
    const { events: instructions } = useSubscribe<NDKLLMRule>(
        [{ kinds: [1339 as NDKKind], limit: 100 }],
        { wrap: true },
        []
    );

    // Initialize form when editing existing instruction
    useEffect(() => {
        if (isEditing && selectedInstruction && !isCreatingNew) {
            const instructionTags = selectedInstruction.tags
                .filter((tag) => tag[0] === "t" && tag[1])
                .map((tag) => tag[1] as string);

            setFormData({
                title: selectedInstruction.title || selectedInstruction.tagValue?.("title") || "",
                description:
                    selectedInstruction.description ||
                    selectedInstruction.tagValue?.("description") ||
                    "",
                content: selectedInstruction.content || "",
                tags: instructionTags,
                newTag: "",
            });
        }
    }, [isEditing, selectedInstruction, isCreatingNew, setFormData]);

    const handleSave = async () => {
        if (!validateForm()) return;

        const success = await saveInstruction(formData, selectedInstruction, isCreatingNew);
        if (success) {
            cancelEditing();
            resetForm();
        }
    };

    const handleCancel = () => {
        cancelEditing();
        resetForm();
    };

    const handleCopyId = () => {
        if (selectedInstruction) {
            copyInstructionId(selectedInstruction);
        }
    };

    return (
        <div className="h-screen bg-background flex">
            <InstructionsList
                instructions={instructions}
                selectedInstruction={selectedInstruction}
                onSelectInstruction={selectInstruction}
                onCreateNew={startCreatingNew}
                onBack={onBack}
            />

            <div className="flex-1 flex flex-col">
                {!selectedInstruction && !isCreatingNew ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                                <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Select an Instruction
                            </h3>
                            <p className="text-muted-foreground">
                                Choose an instruction from the sidebar to view its content, or
                                create a new one
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <InstructionHeader
                            selectedInstruction={selectedInstruction}
                            isCreatingNew={isCreatingNew}
                            isEditing={isEditing}
                            copiedId={copiedId}
                            formData={formData}
                            onEdit={startEditing}
                            onCancel={handleCancel}
                            onSave={handleSave}
                            onCopyId={handleCopyId}
                        />

                        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-muted/30 to-muted/10">
                            {isEditing ? (
                                <InstructionForm
                                    formData={formData}
                                    onFieldChange={updateField}
                                    onAddTag={addTag}
                                    onRemoveTag={removeTag}
                                />
                            ) : (
                                <>
                                    {isCreatingNew ? (
                                        <div className="text-center py-12">
                                            <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                                            <p className="text-muted-foreground text-lg">
                                                Fill out the form above to create your instruction
                                            </p>
                                        </div>
                                    ) : selectedInstruction ? (
                                        <InstructionDetail instruction={selectedInstruction} />
                                    ) : (
                                        <div className="text-center py-12">
                                            <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                                            <p className="text-muted-foreground text-lg">
                                                No instruction selected
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
