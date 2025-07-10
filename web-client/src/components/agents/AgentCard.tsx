import { Bot, Server, Terminal } from "lucide-react";
import { memo } from "react";
import type { NDKAgent } from "@tenex/cli/events";
import { ProfileDisplay } from "../ProfileDisplay";
import { SelectableCard } from "../common/SelectableCard";

interface AgentCardProps {
    agent: NDKAgent;
    isSelected: boolean;
    onSelect: (agent: NDKAgent) => void;
    onDeselect: (agent: NDKAgent) => void;
}

export const AgentCard = memo(function AgentCard({
    agent,
    isSelected,
    onSelect,
    onDeselect,
}: AgentCardProps) {
    const isMCPTool = agent.type === 'mcp-server';
    
    return (
        <SelectableCard
            item={agent}
            isSelected={isSelected}
            onSelect={onSelect}
            onDeselect={onDeselect}
            renderIcon={() => 
                isMCPTool 
                    ? <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <Bot className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            }
            renderTitle={(agent) => agent.name || (isMCPTool ? "Unnamed MCP Tool" : "Unnamed Agent")}
            renderDescription={(agent) => (
                <>
                    {agent.description && <p className="mb-2">{agent.description}</p>}
                    {isMCPTool && agent.mcpCommand && (
                        <div className="flex items-center gap-2">
                            <Terminal className="h-3 w-3 text-muted-foreground" />
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                {agent.mcpCommand}
                            </code>
                        </div>
                    )}
                    {!isMCPTool && agent.role && <p className="text-primary font-medium">Role: {agent.role}</p>}
                </>
            )}
            renderMeta={(agent) => (
                <div className="flex items-center gap-4">
                    <ProfileDisplay
                        pubkey={agent.pubkey || ""}
                        size="sm"
                        nameClassName="text-muted-foreground"
                    />
                    {agent.version && <span>v{agent.version}</span>}
                </div>
            )}
            renderTags={(agent) =>
                agent.tags.filter((tag) => tag[0] === "t" && tag[1]).map((tag) => tag[1] as string)
            }
        />
    );
});
