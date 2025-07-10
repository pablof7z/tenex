import { Check, Copy, Edit, MoreHorizontal, Trash, X } from "lucide-react";
import { useState } from "react";
import { NDKMCPTool } from "@tenex/cli/events";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface MCPToolHeaderProps {
    tool: NDKMCPTool | null;
    isCreatingNew: boolean;
    isEditing: boolean;
    copiedId: string | null;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onCopyToolId: (tool: NDKMCPTool) => void;
    onDeleteTool: (tool: NDKMCPTool) => void;
}

export function MCPToolHeader({
    tool,
    isCreatingNew,
    isEditing,
    copiedId,
    onEdit,
    onCancel,
    onSave,
    onCopyToolId,
    onDeleteTool,
}: MCPToolHeaderProps) {
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                    {isCreatingNew
                        ? "Create New MCP Tool"
                        : isEditing
                        ? `Edit ${tool?.name || "MCP Tool"}`
                        : tool?.name || "MCP Tool Details"}
                </h2>

                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={onCancel}>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? "Publishing..." : isCreatingNew ? "Publish tool" : "Update tool"}
                            </Button>
                        </>
                    ) : (
                        tool && (
                            <>
                                <Button onClick={onEdit}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onCopyToolId(tool)}>
                                            {copiedId === tool.id ? (
                                                <>
                                                    <Check className="w-4 h-4 mr-2" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4 mr-2" />
                                                    Copy tool ID
                                                </>
                                            )}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() => onDeleteTool(tool)}
                                            className="text-destructive"
                                        >
                                            <Trash className="w-4 h-4 mr-2" />
                                            Delete tool
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}