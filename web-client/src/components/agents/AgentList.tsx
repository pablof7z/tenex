import { ArrowLeft, Plus } from "lucide-react";
import type { NDKAgent } from "../../lib/ndk-setup";
import { Button } from "../ui/button";

interface AgentListProps {
    agents: NDKAgent[];
    selectedAgent: NDKAgent | null;
    onBack: () => void;
    onAgentSelect: (agent: NDKAgent) => void;
    onCreateNew: () => void;
}

export function AgentList({
    agents,
    selectedAgent,
    onBack,
    onAgentSelect,
    onCreateNew,
}: AgentListProps) {
    return (
        <div className="w-80 bg-card border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                    <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="text-lg font-semibold text-foreground">Agents</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/30">
                {agents.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No agents found</div>
                ) : (
                    <div className="p-2">
                        {agents.map((agent) => {
                            const name = agent.title || "Unnamed Agent";
                            const version = agent.tagValue("ver") || "1";
                            const description =
                                agent.description || `${agent.content?.slice(0, 100)}...`;

                            return (
                                <div
                                    key={agent.id}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                        selectedAgent?.id === agent.id
                                            ? "bg-primary/10 border border-primary/20"
                                            : "hover:bg-accent"
                                    }`}
                                    onClick={() => onAgentSelect(agent)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            onAgentSelect(agent);
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-medium text-sm text-foreground">
                                            {name}
                                        </h3>
                                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                            v{version}
                                        </span>
                                    </div>
                                    {description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add new agent button */}
            <div className="p-2 border-t border-border">
                <Button variant="outline" size="sm" className="w-full" onClick={onCreateNew}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add new agent
                </Button>
            </div>
        </div>
    );
}
