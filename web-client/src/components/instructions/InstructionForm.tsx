import { FileText, Plus, Sparkles, Tag, X } from "lucide-react";
import type { InstructionFormData } from "../../hooks/useInstructionForm";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface InstructionFormProps {
    formData: InstructionFormData;
    onFieldChange: (field: keyof InstructionFormData, value: string) => void;
    onAddTag: () => void;
    onRemoveTag: (tag: string) => void;
}

export function InstructionForm({
    formData,
    onFieldChange,
    onAddTag,
    onRemoveTag,
}: InstructionFormProps) {
    return (
        <div className="max-w-3xl mx-auto p-8">
            <div className="bg-card rounded-xl shadow-sm border border-border p-8">
                <div className="space-y-8">
                    <div className="space-y-2">
                        <label
                            htmlFor="instruction-title"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <FileText className="w-4 h-4 text-blue-600" />
                            Instruction Title
                            <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="instruction-title"
                            value={formData.title}
                            onChange={(e) => onFieldChange("title", e.target.value)}
                            placeholder="e.g., Code Review Guidelines"
                            className="w-full h-12 px-4 text-base"
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="instruction-description"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <FileText className="w-4 h-4 text-purple-600" />
                            Description
                        </label>
                        <Textarea
                            id="instruction-description"
                            value={formData.description}
                            onChange={(e) => onFieldChange("description", e.target.value)}
                            placeholder="Brief description of this instruction..."
                            rows={3}
                            className="w-full p-4 text-base resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="instruction-tags"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <Tag className="w-4 h-4 text-orange-600" />
                            Tags
                        </label>
                        <div className="flex gap-2">
                            <Input
                                id="instruction-tags"
                                value={formData.newTag}
                                onChange={(e) => onFieldChange("newTag", e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        onAddTag();
                                    }
                                }}
                                placeholder="Add a tag and press Enter..."
                                className="flex-1 h-12 px-4 text-base"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                onClick={onAddTag}
                                disabled={!formData.newTag.trim()}
                                className="h-12 px-4"
                            >
                                <Plus className="w-5 h-5" />
                            </Button>
                        </div>
                        {formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {formData.tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="px-3 py-1.5 text-sm bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer transition-all flex items-center gap-1.5 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
                                        onClick={() => onRemoveTag(tag)}
                                    >
                                        {tag}
                                        <X className="w-3 h-3" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="instruction-content"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            Instruction Content
                            <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            id="instruction-content"
                            value={formData.content}
                            onChange={(e) => onFieldChange("content", e.target.value)}
                            placeholder="Enter the full instruction content..."
                            rows={12}
                            className="w-full p-4 font-mono text-sm resize-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
