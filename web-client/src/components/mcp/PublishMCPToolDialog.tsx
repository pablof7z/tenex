import { useState } from "react";
import { Server, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMCPToolForm } from "@/hooks/useMCPToolForm";

interface PublishMCPToolDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function PublishMCPToolDialog({ open, onOpenChange, onSuccess }: PublishMCPToolDialogProps) {
    const {
        data,
        errors,
        updateField,
        validateField,
        saveMCPTool,
        addTag,
        removeTag,
        addPath,
        removePath,
        addEnvVar,
        removeEnvVar,
        reset,
    } = useMCPToolForm();

    const [isPublishing, setIsPublishing] = useState(false);
    const [newPath, setNewPath] = useState("");

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            const success = await saveMCPTool(null, true);
            if (success) {
                reset();
                onSuccess?.();
                onOpenChange(false);
            }
        } finally {
            setIsPublishing(false);
        }
    };

    const handleAddPath = () => {
        if (newPath.trim()) {
            addPath(newPath.trim());
            setNewPath("");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Server className="w-5 h-5" />
                        Publish MCP Tool
                    </DialogTitle>
                    <DialogDescription>
                        Share a Model Context Protocol server with the community
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Name *</Label>
                        <Input
                            id="title"
                            value={data.title}
                            onChange={(e) => updateField("title", e.target.value)}
                            onBlur={() => validateField("title", data.title)}
                            placeholder="e.g., YouTube MCP Server"
                        />
                        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => updateField("description", e.target.value)}
                            onBlur={() => validateField("description", data.description)}
                            placeholder="Brief description of what this MCP tool does"
                            rows={3}
                        />
                        {errors.description && (
                            <p className="text-sm text-destructive">{errors.description}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="command">Installation Command *</Label>
                        <Input
                            id="command"
                            value={data.command}
                            onChange={(e) => updateField("command", e.target.value)}
                            onBlur={() => validateField("command", data.command)}
                            placeholder="e.g., npx @modelcontextprotocol/server-youtube"
                            className="font-mono text-sm"
                        />
                        {errors.command && <p className="text-sm text-destructive">{errors.command}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image">Image URL (optional)</Label>
                        <Input
                            id="image"
                            value={data.image}
                            onChange={(e) => updateField("image", e.target.value)}
                            placeholder="https://example.com/icon.png"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Allowed Paths (optional)</Label>
                        <div className="flex gap-2">
                            <Input
                                value={newPath}
                                onChange={(e) => setNewPath(e.target.value)}
                                placeholder="/path/to/allow"
                                onKeyPress={(e) => e.key === "Enter" && handleAddPath()}
                            />
                            <Button type="button" onClick={handleAddPath} size="sm">
                                Add
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {data.paths.map((path) => (
                                <Badge key={path} variant="secondary">
                                    {path}
                                    <button
                                        onClick={() => removePath(path)}
                                        className="ml-1 hover:text-destructive"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Environment Variables (optional)</Label>
                        <div className="flex gap-2">
                            <Input
                                value={data.newEnvKey}
                                onChange={(e) => updateField("newEnvKey", e.target.value)}
                                placeholder="KEY"
                                className="flex-1"
                            />
                            <Input
                                value={data.newEnvValue}
                                onChange={(e) => updateField("newEnvValue", e.target.value)}
                                placeholder="VALUE"
                                className="flex-1"
                            />
                            <Button type="button" onClick={addEnvVar} size="sm">
                                Add
                            </Button>
                        </div>
                        <div className="space-y-1 mt-2">
                            {Object.entries(data.env).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2 text-sm">
                                    <code className="bg-muted px-2 py-1 rounded">
                                        {key}={value}
                                    </code>
                                    <button
                                        onClick={() => removeEnvVar(key)}
                                        className="text-destructive hover:text-destructive/80"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Tags</Label>
                        <div className="flex gap-2">
                            <Input
                                value={data.newTag}
                                onChange={(e) => updateField("newTag", e.target.value)}
                                placeholder="Add a tag"
                                onKeyPress={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                            />
                            <Button type="button" onClick={addTag} size="sm">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {data.tags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                    {tag}
                                    <button
                                        onClick={() => removeTag(tag)}
                                        className="ml-1 hover:text-destructive"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handlePublish} disabled={isPublishing}>
                        {isPublishing ? "Publishing..." : "Publish MCP Tool"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}