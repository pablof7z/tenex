import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { useProfileValue } from "@nostr-dev-kit/ndk-hooks";
import { ArrowRight, Bot, Sparkles, Users } from "lucide-react";
import { memo, useMemo } from "react";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

interface AgentDiscoveryCardProps {
    event: NDKEvent;
}

interface AgentInfo {
    pubkey: string;
    name: string;
    role?: string;
    description?: string;
}

export const AgentDiscoveryCard = memo(function AgentDiscoveryCard({
    event,
}: AgentDiscoveryCardProps) {
    const profile = useProfileValue(event.pubkey);
    const { formatRelativeTime } = useTimeFormat();

    // Parse the event content to get agent information
    const discoveredAgents = useMemo(() => {
        try {
            const content = JSON.parse(event.content);
            if (Array.isArray(content.agents)) {
                return content.agents as AgentInfo[];
            }
            return [];
        } catch {
            // If content is not JSON, return empty array
            return [];
        }
    }, [event.content]);

    const getAgentName = () => {
        return profile?.name || event.tagValue("agent") || "Discovery Agent";
    };

    if (discoveredAgents.length === 0) {
        // Fallback to regular status update if no agents found
        return null;
    }

    return (
        <div className="flex gap-3 p-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
                <Avatar className="w-8 h-8">
                    <AvatarImage src={profile?.image} alt={profile?.name || "Agent"} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-primary-foreground text-xs">
                        <Sparkles className="w-4 h-4" />
                    </AvatarFallback>
                </Avatar>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm text-foreground">{getAgentName()}</span>
                    <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(event.created_at!)}
                    </span>
                    <Badge variant="secondary" className="text-xs h-5 px-2">
                        <Users className="w-3 h-3 mr-1" />
                        Agent Discovery
                    </Badge>
                </div>

                {/* Discovery Card */}
                <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <h3 className="font-semibold text-base">
                            Found {discoveredAgents.length} specialized{" "}
                            {discoveredAgents.length === 1 ? "agent" : "agents"}
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {discoveredAgents.map((agent, index) => (
                            <AgentItem key={agent.pubkey || index} agent={agent} />
                        ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-800">
                        <p className="text-sm text-muted-foreground">
                            These agents can help with specialized tasks in your project. They'll be
                            automatically included when relevant.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
});

// Individual agent item component
const AgentItem = memo(function AgentItem({ agent }: { agent: AgentInfo }) {
    const profile = useProfileValue(agent.pubkey);

    return (
        <div className="flex items-start gap-3 p-3 bg-background/60 rounded-lg">
            <Avatar className="w-10 h-10 flex-shrink-0">
                <AvatarImage src={profile?.image} alt={agent.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-primary-foreground text-xs">
                    <Bot className="w-5 h-5" />
                </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm">{agent.name}</h4>
                    {agent.role && (
                        <Badge variant="outline" className="text-xs h-5 px-2">
                            {agent.role}
                        </Badge>
                    )}
                </div>
                {agent.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {agent.description}
                    </p>
                )}
            </div>

            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
    );
});
