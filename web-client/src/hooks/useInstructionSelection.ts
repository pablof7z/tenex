import { useCallback, useState } from "react";
import type { NDKLLMRule } from "../types/template";

export function useInstructionSelection() {
    const [selectedInstruction, setSelectedInstruction] = useState<NDKLLMRule | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    const selectInstruction = useCallback((instruction: NDKLLMRule) => {
        setSelectedInstruction(instruction);
        setIsEditing(false);
        setIsCreatingNew(false);
    }, []);

    const startCreatingNew = useCallback(() => {
        setSelectedInstruction(null);
        setIsCreatingNew(true);
        setIsEditing(true);
    }, []);

    const startEditing = useCallback(() => {
        setIsEditing(true);
    }, []);

    const cancelEditing = useCallback(() => {
        setIsEditing(false);
        setIsCreatingNew(false);
    }, []);

    return {
        selectedInstruction,
        isEditing,
        isCreatingNew,
        selectInstruction,
        startCreatingNew,
        startEditing,
        cancelEditing,
    };
}
