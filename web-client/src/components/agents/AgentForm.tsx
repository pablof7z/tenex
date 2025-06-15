import { Bot, FileText, Plus, Sparkles, Tag, User, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface AgentFormData {
    title: string;
    description: string;
    role: string;
    instructions: string;
    tags: string[];
    newTag: string;
}

interface AgentFormProps {
    formData: AgentFormData;
    onFormChange: (field: keyof AgentFormData, value: string) => void;
    onAddTag: () => void;
    onRemoveTag: (tag: string) => void;
}

export function AgentForm({ formData, onFormChange, onAddTag, onRemoveTag }: AgentFormProps) {
    return (
        <div className="max-w-3xl mx-auto p-8">
            <div className="bg-card rounded-xl shadow-sm border border-border p-8">
                <div className="space-y-8">
                    {/* Title */}
                    <div className="space-y-2">
                        <label
                            htmlFor="agent-name"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <Bot className="w-4 h-4 text-blue-600" />
                            Agent Name
                            <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="agent-name"
                            value={formData.title}
                            onChange={(e) => onFormChange("title", e.target.value)}
                            placeholder="e.g., Code Reviewer Agent"
                            className="w-full h-12 px-4 text-base"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label
                            htmlFor="agent-description"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <FileText className="w-4 h-4 text-purple-600" />
                            Description
                        </label>
                        <Textarea
                            id="agent-description"
                            value={formData.description}
                            onChange={(e) => onFormChange("description", e.target.value)}
                            placeholder="Brief description of what this agent does..."
                            rows={3}
                            className="w-full p-4 text-base resize-none"
                        />
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                        <label
                            htmlFor="agent-role"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <User className="w-4 h-4 text-green-600" />
                            Role/Specialty
                        </label>
                        <Input
                            id="agent-role"
                            value={formData.role}
                            onChange={(e) => onFormChange("role", e.target.value)}
                            placeholder="e.g., Senior Software Engineer, UX Designer, DevOps Specialist"
                            className="w-full h-12 px-4 text-base border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                        />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <label
                            htmlFor="agent-tags"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <Tag className="w-4 h-4 text-orange-600" />
                            Tags
                        </label>
                        <div className="flex gap-2">
                            <Input
                                id="agent-tags"
                                value={formData.newTag}
                                onChange={(e) => onFormChange("newTag", e.target.value)}
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
                                        className="px-3 py-1.5 text-sm bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 cursor-pointer transition-all flex items-center gap-1.5"
                                        onClick={() => onRemoveTag(tag)}
                                    >
                                        {tag}
                                        <X className="w-3 h-3" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2">
                        <label
                            htmlFor="agent-instructions"
                            className="flex items-center gap-2 text-sm font-semibold text-foreground"
                        >
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            Detailed Instructions
                        </label>
                        <Textarea
                            id="agent-instructions"
                            value={formData.instructions}
                            onChange={(e) => onFormChange("instructions", e.target.value)}
                            placeholder="Detailed instructions for how the agent should operate, its personality, specific guidelines, etc..."
                            rows={12}
                            className="w-full p-4 font-mono text-sm resize-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
