import { NDKEvent } from "@nostr-dev-kit/ndk";
import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useCallback, useState } from "react";
import type { NDKLLMRule } from "../types/template";
import type { InstructionFormData } from "./useInstructionForm";

export function useInstructionActions() {
    const { ndk } = useNDK();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const saveInstruction = useCallback(
        async (
            formData: InstructionFormData,
            selectedInstruction: NDKLLMRule | null,
            isCreatingNew: boolean
        ) => {
            if (!ndk) return false;

            const newInstruction = new NDKEvent(ndk);
            newInstruction.kind = 1339;
            newInstruction.content = formData.content;

            if (isCreatingNew) {
                newInstruction.tags = [
                    ["title", formData.title],
                    ["ver", "1"],
                ];

                if (formData.description) {
                    newInstruction.tags.push(["description", formData.description]);
                }

                for (const tag of formData.tags) {
                    newInstruction.tags.push(["t", tag]);
                }
            } else if (selectedInstruction) {
                const currentVersion = selectedInstruction.version || "1";
                const newVersion = String(Number.parseInt(currentVersion) + 1);

                newInstruction.tags = [
                    ["title", formData.title],
                    ["ver", newVersion],
                ];

                if (formData.description) {
                    newInstruction.tags.push(["description", formData.description]);
                }

                for (const tag of formData.tags) {
                    newInstruction.tags.push(["t", tag]);
                }
            }

            try {
                await newInstruction.publish();
                return true;
            } catch (_error) {
                // console.error("Failed to publish instruction:", error);
                return false;
            }
        },
        [ndk]
    );

    const copyInstructionId = useCallback(async (instruction: NDKLLMRule) => {
        if (!instruction) return;

        try {
            const encoded = instruction.encode();
            await navigator.clipboard.writeText(encoded);
            setCopiedId(instruction.id);

            setTimeout(() => {
                setCopiedId(null);
            }, 2000);
        } catch (_error) {
            // console.error("Failed to copy instruction ID:", error);
        }
    }, []);

    return {
        saveInstruction,
        copyInstructionId,
        copiedId,
    };
}
