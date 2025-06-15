import { useCallback, useState } from "react";

export interface InstructionFormData {
    title: string;
    description: string;
    content: string;
    tags: string[];
    newTag: string;
}

const initialFormData: InstructionFormData = {
    title: "",
    description: "",
    content: "",
    tags: [],
    newTag: "",
};

export function useInstructionForm(initialData?: Partial<InstructionFormData>) {
    const [formData, setFormData] = useState<InstructionFormData>({
        ...initialFormData,
        ...initialData,
    });

    const updateField = useCallback(
        (field: keyof InstructionFormData, value: string | string[]) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
        },
        []
    );

    const addTag = useCallback(() => {
        if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
            setFormData((prev) => ({
                ...prev,
                tags: [...prev.tags, prev.newTag.trim()],
                newTag: "",
            }));
        }
    }, [formData.newTag, formData.tags]);

    const removeTag = useCallback((tagToRemove: string) => {
        setFormData((prev) => ({
            ...prev,
            tags: prev.tags.filter((tag) => tag !== tagToRemove),
        }));
    }, []);

    const resetForm = useCallback(() => {
        setFormData(initialFormData);
    }, []);

    const validateForm = useCallback(() => {
        if (!formData.title.trim()) {
            alert("Instruction title is required");
            return false;
        }
        if (!formData.content.trim()) {
            alert("Instruction content is required");
            return false;
        }
        return true;
    }, [formData.title, formData.content]);

    return {
        formData,
        updateField,
        addTag,
        removeTag,
        resetForm,
        validateForm,
        setFormData,
    };
}
