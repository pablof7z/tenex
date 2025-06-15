import { FileText, Sparkles, Tag } from "lucide-react";
import type { NDKLLMRule } from "../../types/template";
import { Badge } from "../ui/badge";

interface InstructionDetailProps {
    instruction: NDKLLMRule;
}

export function InstructionDetail({ instruction }: InstructionDetailProps) {
    return (
        <div className="max-w-3xl mx-auto p-8">
            <div className="bg-card rounded-xl shadow-sm border border-border p-8">
                <div className="space-y-6">
                    <div className="border-b border-border pb-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                <FileText className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-foreground mb-2">
                                    {instruction.title ||
                                        instruction.tagValue?.("title") ||
                                        "Untitled Instruction"}
                                </h3>
                                {instruction.description && (
                                    <p className="text-muted-foreground text-base leading-relaxed">
                                        {instruction.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {instruction.hashtags && instruction.hashtags.length > 0 && (
                        <div className="flex items-start gap-2">
                            <Tag className="w-5 h-5 text-orange-600 mt-0.5" />
                            <div className="flex flex-wrap gap-2">
                                {instruction.hashtags.map((tag) => (
                                    <Badge
                                        key={`tag-${tag}`}
                                        variant="outline"
                                        className="text-sm px-3 py-1 bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300"
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {instruction.content && (
                        <div className="mt-8">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-5 h-5 text-indigo-600" />
                                <h4 className="text-lg font-semibold text-foreground">Content</h4>
                            </div>
                            <div className="bg-gradient-to-br from-muted/50 to-muted/30 p-6 rounded-xl border border-border">
                                <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
                                    {instruction.content}
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
