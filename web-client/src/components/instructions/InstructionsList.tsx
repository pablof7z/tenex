import { ArrowLeft, Plus } from "lucide-react";
import type { NDKLLMRule } from "../../types/template";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface InstructionsListProps {
    instructions: NDKLLMRule[];
    selectedInstruction: NDKLLMRule | null;
    onSelectInstruction: (instruction: NDKLLMRule) => void;
    onCreateNew: () => void;
    onBack: () => void;
}

export function InstructionsList({
    instructions,
    selectedInstruction,
    onSelectInstruction,
    onCreateNew,
    onBack,
}: InstructionsListProps) {
    return (
        <div className="w-80 bg-card border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                    <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="text-lg font-semibold text-foreground">Instructions</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/30">
                {instructions.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                        No instructions found
                    </div>
                ) : (
                    <div className="p-2">
                        {instructions.map((instruction) => {
                            const title =
                                instruction.title || instruction.tagValue?.("title") || "Untitled";
                            const version = instruction.version || "1";
                            const description =
                                instruction.description ||
                                `${instruction.content?.slice(0, 100)}...`;
                            const tags = instruction.getMatchingTags("t").map((tag) => tag[1]);

                            return (
                                <button
                                    key={instruction.id}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors w-full text-left ${
                                        selectedInstruction?.id === instruction.id
                                            ? "bg-primary/10 border border-primary/20"
                                            : "hover:bg-accent"
                                    }`}
                                    onClick={() => onSelectInstruction(instruction)}
                                    type="button"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-medium text-sm text-foreground">
                                            {title}
                                        </h3>
                                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                            v{version}
                                        </span>
                                    </div>
                                    {description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                            {description}
                                        </p>
                                    )}
                                    {tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
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
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-2">
                <Button size="lg" className="w-full" onClick={onCreateNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add new instruction
                </Button>
            </div>
        </div>
    );
}
