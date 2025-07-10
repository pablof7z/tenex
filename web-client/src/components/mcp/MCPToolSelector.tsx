import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Server } from "lucide-react";
import { NDKMCPTool } from "@tenex/cli/events";
import { ItemSelector } from "../common/ItemSelector";
import { MCPToolCard } from "./MCPToolCard";

interface MCPToolSelectorProps {
    selectedTools: NDKMCPTool[];
    onToolsChange: (tools: NDKMCPTool[]) => void;
}

export function MCPToolSelector({ selectedTools, onToolsChange }: MCPToolSelectorProps) {
    const { events: mcpTools } = useSubscribe<NDKMCPTool>(
        [{ kinds: [NDKMCPTool.kind], limit: 100 }],
        { wrap: true },
        []
    );

    const handleToolSelect = (tool: NDKMCPTool) => {
        if (!selectedTools.find((t) => t.id === tool.id)) {
            onToolsChange([...selectedTools, tool]);
        }
    };

    const handleToolDeselect = (tool: NDKMCPTool) => {
        onToolsChange(selectedTools.filter((t) => t.id !== tool.id));
    };

    return (
        <ItemSelector
            items={mcpTools}
            selectedItems={selectedTools}
            onItemsChange={onToolsChange}
            searchPlaceholder="Search MCP tools..."
            filterLabel="Filters"
            emptyStateIcon={<Server className="w-6 h-6 text-muted-foreground" />}
            emptyStateTitle="No MCP tools found"
            renderCard={(tool, isSelected) => (
                <MCPToolCard
                    tool={tool}
                    isSelected={isSelected}
                    onSelect={handleToolSelect}
                    onDeselect={handleToolDeselect}
                />
            )}
            getItemId={(tool) => tool.id || ""}
            getItemTags={(tool) =>
                tool.tags.filter((tag) => tag[0] === "t" && tag[1]).map((tag) => tag[1] as string)
            }
            searchFilter={(tool, searchTerm) => {
                const searchLower = searchTerm.toLowerCase();
                return (
                    tool.name?.toLowerCase().includes(searchLower) ||
                    tool.description?.toLowerCase().includes(searchLower) ||
                    tool.command?.toLowerCase().includes(searchLower) ||
                    false
                );
            }}
        />
    );
}