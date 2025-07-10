import { type NDKProject, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Plus, Server, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NDKMCPTool } from "@tenex/cli/events";
import { MCPToolSelector } from "../mcp/MCPToolSelector";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface MCPToolsSettingsProps {
    project: NDKProject;
    editedProject: NDKProject;
    onProjectChanged: () => void;
}

interface ProjectMCPTool {
    id: string;
    tool?: NDKMCPTool;
}

export function MCPToolsSettings({ project, editedProject, onProjectChanged }: MCPToolsSettingsProps) {
    const [projectTools, setProjectTools] = useState<ProjectMCPTool[]>([]);
    const [showToolSelector, setShowToolSelector] = useState(false);

    // Get MCP tool event IDs from project tags - memoize to prevent recreating array on every render
    const toolIds = useMemo(() => {
        return project.tags
            .filter((tag) => tag[0] === "mcp" && tag[1])
            .map((tag) => tag[1] as string);
    }, [project.tags]);

    // Memoize the tool IDs key to prevent unnecessary re-subscriptions
    const toolIdsKey = useMemo(() => toolIds.join(","), [toolIds]);

    // Subscribe to MCP tool events
    const { events: toolEvents } = useSubscribe<NDKMCPTool>(
        toolIds.length > 0
            ? [
                  {
                      kinds: [NDKMCPTool.kind],
                      ids: toolIds,
                  },
              ]
            : false,
        { wrap: true },
        [toolIdsKey]
    );

    // Update projectTools when tool events are loaded
    useEffect(() => {
        const tools: ProjectMCPTool[] = toolIds.map((id) => {
            const tool = toolEvents.find((e) => e.id === id);
            return { id, tool };
        });
        setProjectTools(tools);
    }, [toolEvents, toolIds]);

    const handleAddTools = (selectedTools: NDKMCPTool[]) => {
        const newTools = selectedTools.filter(
            (tool) => !projectTools.some((pt) => pt.id === tool.id)
        );
        if (newTools.length > 0) {
            const updatedTools = [
                ...projectTools,
                ...newTools.map((tool) => ({ id: tool.id, tool })),
            ];
            setProjectTools(updatedTools);

            // Update the edited project
            editedProject.tags = editedProject.tags.filter((tag) => tag[0] !== "mcp");
            for (const pt of updatedTools) {
                editedProject.tags.push(["mcp", pt.id]);
            }

            onProjectChanged();
        }
        setShowToolSelector(false);
    };

    const handleRemoveTool = (toolId: string) => {
        const updatedTools = projectTools.filter((pt) => pt.id !== toolId);
        setProjectTools(updatedTools);

        // Update the edited project
        editedProject.tags = editedProject.tags.filter((tag) => tag[0] !== "mcp");
        for (const pt of updatedTools) {
            editedProject.tags.push(["mcp", pt.id]);
        }

        onProjectChanged();
    };

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-slate-900">MCP Tools</h2>
                    <Button
                        onClick={() => setShowToolSelector(true)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add MCP Tool
                    </Button>
                </div>
                <p className="text-sm text-slate-600">
                    Manage Model Context Protocol servers available to agents in this project
                </p>
            </div>

            {/* Tool List */}
            <div className="space-y-3">
                {projectTools.length === 0 ? (
                    <div className="bg-white rounded-lg p-12 text-center">
                        <Server className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">No MCP tools configured</p>
                        <p className="text-sm text-slate-500">
                            Add MCP servers to extend agent capabilities
                        </p>
                    </div>
                ) : (
                    projectTools.map((pt) => (
                        <MCPToolCard
                            key={pt.id}
                            projectTool={pt}
                            onRemove={() => handleRemoveTool(pt.id)}
                        />
                    ))
                )}
            </div>

            {/* Tool Selector Dialog */}
            <Dialog open={showToolSelector} onOpenChange={setShowToolSelector}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Select MCP Tools</DialogTitle>
                    </DialogHeader>
                    <MCPToolSelector
                        selectedTools={
                            projectTools.map((pt) => pt.tool).filter(Boolean) as NDKMCPTool[]
                        }
                        onToolsChange={handleAddTools}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MCPToolCard({
    projectTool,
    onRemove,
}: {
    projectTool: ProjectMCPTool;
    onRemove: () => void;
}) {
    const tool = projectTool.tool;

    if (!tool) {
        return (
            <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                            <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRemove}
                        className="text-slate-400 hover:text-red-600"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    }

    const getToolAvatar = () => {
        if (tool.image) return tool.image;
        return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(tool.id)}`;
    };

    return (
        <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                        <AvatarImage src={getToolAvatar()} alt={tool.name} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                            <Server className="h-5 w-5 text-white" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900">
                            {tool.name || "Unnamed MCP Tool"}
                        </h3>
                        {tool.description && (
                            <p className="text-sm text-slate-600 line-clamp-1">
                                {tool.description}
                            </p>
                        )}
                        {tool.command && (
                            <div className="flex items-center gap-2 mt-1">
                                <Terminal className="h-3 w-3 text-slate-400" />
                                <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">
                                    {tool.command}
                                </code>
                            </div>
                        )}
                        {tool.tags && tool.tags.filter((tag) => tag[0] === "t").length > 0 && (
                            <div className="flex gap-1 mt-1">
                                {tool.tags
                                    .filter((tag) => tag[0] === "t" && tag[1])
                                    .slice(0, 3)
                                    .map((tag) => (
                                        <Badge key={tag[1]} variant="secondary" className="text-xs">
                                            {tag[1]}
                                        </Badge>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    className="text-slate-400 hover:text-red-600"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}