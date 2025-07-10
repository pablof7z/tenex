import { ArrowLeft, Plus, Search, Server } from "lucide-react";
import { useMemo, useState } from "react";
import { NDKMCPTool } from "@tenex/cli/events";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface MCPToolListProps {
    tools: NDKMCPTool[];
    selectedTool: NDKMCPTool | null;
    onBack: () => void;
    onToolSelect: (tool: NDKMCPTool) => void;
    onCreateNew: () => void;
}

export function MCPToolList({
    tools,
    selectedTool,
    onBack,
    onToolSelect,
    onCreateNew,
}: MCPToolListProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredTools = useMemo(() => {
        if (!searchTerm) return tools;

        const lowerSearchTerm = searchTerm.toLowerCase();
        return tools.filter(
            (tool) =>
                tool.name?.toLowerCase().includes(lowerSearchTerm) ||
                tool.description?.toLowerCase().includes(lowerSearchTerm) ||
                tool.command?.toLowerCase().includes(lowerSearchTerm)
        );
    }, [tools, searchTerm]);

    return (
        <div className="w-full md:w-80 lg:w-96 border-r flex flex-col">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="sm" onClick={onBack}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <h1 className="text-lg font-semibold">MCP Tools</h1>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        type="search"
                        placeholder="Search MCP tools..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Tool List */}
            <div className="flex-1 overflow-y-auto">
                {filteredTools.length === 0 ? (
                    <div className="text-center py-8 px-4">
                        <Server className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-muted-foreground">
                            {searchTerm ? "No MCP tools found" : "No MCP tools published yet"}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredTools.map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => onToolSelect(tool)}
                                className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                                    selectedTool?.id === tool.id ? "bg-accent" : ""
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <Server className="w-5 h-5 text-muted-foreground mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate">
                                            {tool.name || "Unnamed Tool"}
                                        </h3>
                                        {tool.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                                {tool.description}
                                            </p>
                                        )}
                                        {tool.command && (
                                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono mt-2 inline-block">
                                                {tool.command}
                                            </code>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Add New Button */}
            <div className="p-4 border-t">
                <Button onClick={onCreateNew} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add new MCP tool
                </Button>
            </div>
        </div>
    );
}