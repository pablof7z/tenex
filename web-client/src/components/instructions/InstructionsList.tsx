import React from "react"
import type { NDKLLMRule } from "../../types/template"
import { Badge } from "../ui/badge"
import { EntityListSidebar } from "@/components/common/EntityListSidebar"

interface InstructionsListProps {
    instructions: NDKLLMRule[]
    selectedInstruction: NDKLLMRule | null
    onSelectInstruction: (instruction: NDKLLMRule) => void
    onCreateNew: () => void
    onBack: () => void
}

export function InstructionsList({
    instructions,
    selectedInstruction,
    onSelectInstruction,
    onCreateNew,
    onBack,
}: InstructionsListProps) {
    return (
        <EntityListSidebar<NDKLLMRule>
            title="Instructions"
            items={instructions}
            selectedItem={selectedInstruction}
            onBack={onBack}
            onSelect={onSelectInstruction}
            onCreateNew={onCreateNew}
            getItemTitle={(instruction) => 
                instruction.title || instruction.tagValue?.("title") || "Untitled"
            }
            getItemVersion={(instruction) => instruction.version || "1"}
            getItemDescription={(instruction) => 
                instruction.description || 
                (instruction.content ? `${instruction.content.slice(0, 100)}...` : undefined)
            }
            renderItemExtra={(instruction) => {
                const tags = instruction.getMatchingTags("t").map((tag) => tag[1])
                return tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {tags.map((tag) => (
                            <Badge
                                key={`tag-${tag}`}
                                variant="secondary"
                                className="text-xs px-2 py-0.5"
                            >
                                {tag}
                            </Badge>
                        ))}
                    </div>
                ) : null
            }}
            createButtonText="Add new instruction"
            className="w-80"
            itemsClassName="bg-muted/30"
        />
    )
}