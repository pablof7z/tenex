import { type NDKProject, useProfileValue, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { Plus, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NDKAgent } from "@tenex/cli";
import { AgentSelector } from "../agents/AgentSelector";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface AgentsSettingsProps {
    project: NDKProject;
    editedProject: NDKProject;
    onProjectChanged: () => void;
}

interface ProjectAgent {
    id: string;
    agent?: NDKAgent;
}

export function AgentsSettings({ project, editedProject, onProjectChanged }: AgentsSettingsProps) {
    const [projectAgents, setProjectAgents] = useState<ProjectAgent[]>([]);
    const [showAgentSelector, setShowAgentSelector] = useState(false);

    // Get agent event IDs from project tags - memoize to prevent recreating array on every render
    const agentIds = useMemo(() => {
        return project.tags
            .filter((tag) => tag[0] === "agent" && tag[1])
            .map((tag) => tag[1] as string);
    }, [project.tags]);

    // Memoize the agent IDs key to prevent unnecessary re-subscriptions
    const agentIdsKey = useMemo(() => agentIds.join(","), [agentIds]);

    // Subscribe to agent events
    const { events: agentEvents } = useSubscribe<NDKAgent>(
        agentIds.length > 0
            ? [
                  {
                      kinds: [NDKAgent.kind],
                      ids: agentIds,
                  },
              ]
            : false,
        { wrap: true },
        [agentIdsKey]
    );

    // Update projectAgents when agent events are loaded
    useEffect(() => {
        const agents: ProjectAgent[] = agentIds.map((id) => {
            const agent = agentEvents.find((e) => e.id === id);
            return { id, agent };
        });
        setProjectAgents(agents);
    }, [agentEvents, agentIds]);

    const handleAddAgents = (selectedAgents: NDKAgent[]) => {
        const newAgents = selectedAgents.filter(
            (agent) => !projectAgents.some((pa) => pa.id === agent.id)
        );
        if (newAgents.length > 0) {
            const updatedAgents = [
                ...projectAgents,
                ...newAgents.map((agent) => ({ id: agent.id, agent })),
            ];
            setProjectAgents(updatedAgents);

            // Update the edited project
            editedProject.tags = editedProject.tags.filter((tag) => tag[0] !== "agent");
            for (const pa of updatedAgents) {
                editedProject.tags.push(["agent", pa.id]);
            }

            onProjectChanged();
        }
        setShowAgentSelector(false);
    };

    const handleRemoveAgent = (agentId: string) => {
        const updatedAgents = projectAgents.filter((pa) => pa.id !== agentId);
        setProjectAgents(updatedAgents);

        // Update the edited project
        editedProject.tags = editedProject.tags.filter((tag) => tag[0] !== "agent");
        for (const pa of updatedAgents) {
            editedProject.tags.push(["agent", pa.id]);
        }

        onProjectChanged();
    };

    return (
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-slate-900">Project Agents</h2>
                    <Button
                        onClick={() => setShowAgentSelector(true)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Agent
                    </Button>
                </div>
                <p className="text-sm text-slate-600">
                    Manage AI agents assigned to work on this project
                </p>
            </div>

            {/* Agent List */}
            <div className="space-y-3">
                {projectAgents.length === 0 ? (
                    <div className="bg-white rounded-lg p-12 text-center">
                        <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">No agents assigned</p>
                        <p className="text-sm text-slate-500">
                            Add agents to help work on this project
                        </p>
                    </div>
                ) : (
                    projectAgents.map((pa) => (
                        <AgentCard
                            key={pa.id}
                            projectAgent={pa}
                            onRemove={() => handleRemoveAgent(pa.id)}
                        />
                    ))
                )}
            </div>

            {/* Agent Selector Dialog */}
            <Dialog open={showAgentSelector} onOpenChange={setShowAgentSelector}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Select Agents</DialogTitle>
                    </DialogHeader>
                    <AgentSelector
                        selectedAgents={
                            projectAgents.map((pa) => pa.agent).filter(Boolean) as NDKAgent[]
                        }
                        onAgentsChange={handleAddAgents}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AgentCard({
    projectAgent,
    onRemove,
}: {
    projectAgent: ProjectAgent;
    onRemove: () => void;
}) {
    const agent = projectAgent.agent;
    const authorProfile = useProfileValue(agent?.pubkey);

    if (!agent) {
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

    const getAgentAvatar = () => {
        if (authorProfile?.image) return authorProfile.image;
        return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(agent.id)}`;
    };

    const getAgentInitials = () => {
        const name = agent.name || "Agent";
        return name
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                        <AvatarImage src={getAgentAvatar()} alt={agent.name} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                            {getAgentInitials()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-medium text-slate-900">
                            {agent.name || "Unnamed Agent"}
                        </h3>
                        {agent.description && (
                            <p className="text-sm text-slate-600 line-clamp-1">
                                {agent.description}
                            </p>
                        )}
                        {agent.role && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                                {agent.role}
                            </Badge>
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
