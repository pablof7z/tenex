import { Plus, Tag, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";

interface MCPToolFormProps {
    formData: any;
    onFormChange: (field: string, value: any) => void;
    onAddTag: () => void;
    onRemoveTag: (tag: string) => void;
}

export function MCPToolForm({
    formData,
    onFormChange,
    onAddTag,
    onRemoveTag,
}: MCPToolFormProps) {
    return (
        <div className="p-6 space-y-6">
            {/* Name */}
            <div className="space-y-2">
                <Label htmlFor="title">Name</Label>
                <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => onFormChange("title", e.target.value)}
                    placeholder="e.g., YouTube MCP Server"
                />
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => onFormChange("description", e.target.value)}
                    placeholder="Brief description of what this MCP tool does"
                    rows={3}
                />
            </div>

            {/* Installation Command */}
            <div className="space-y-2">
                <Label htmlFor="command">Installation Command</Label>
                <Input
                    id="command"
                    value={formData.command}
                    onChange={(e) => onFormChange("command", e.target.value)}
                    placeholder="e.g., npx @modelcontextprotocol/server-youtube"
                    className="font-mono text-sm"
                />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
                <Label htmlFor="image">Image URL (optional)</Label>
                <Input
                    id="image"
                    value={formData.image}
                    onChange={(e) => onFormChange("image", e.target.value)}
                    placeholder="https://example.com/icon.png"
                />
            </div>


            {/* Tags */}
            <div className="space-y-2">
                <label
                    htmlFor="mcp-tags"
                    className="flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                    <Tag className="w-4 h-4 text-orange-600" />
                    Tags
                </label>
                <div className="flex gap-2">
                    <Input
                        id="mcp-tags"
                        value={formData.newTag}
                        onChange={(e) => onFormChange("newTag", e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onAddTag();
                            }
                        }}
                        placeholder="Add a tag and press Enter..."
                        className="flex-1 h-10 px-4 text-base"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={onAddTag}
                        disabled={!formData.newTag.trim()}
                        className="h-10 px-4"
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>
                {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {formData.tags.map((tag: string) => (
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
        </div>
    );
}