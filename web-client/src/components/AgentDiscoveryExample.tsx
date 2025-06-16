import type { NDKEvent, NDKKind } from "@nostr-dev-kit/ndk";
import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { useEffect, useState } from "react";

// Example component showing how to handle agent discovery events
export function AgentDiscoveryExample({ event }: { event: NDKEvent }) {
    const { ndk } = useNDK();
    const [agents, setAgents] = useState<NDKEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAgents() {
            // Check if this is an agent discovery event
            const renderType = event.tagValue("render-type");
            if (renderType !== "agent_discovery") {
                setLoading(false);
                return;
            }

            try {
                // Parse the content to get agent event IDs
                const content = JSON.parse(event.content);
                const { agentEventIds } = content.data;

                if (!agentEventIds || agentEventIds.length === 0) {
                    setLoading(false);
                    return;
                }

                // Fetch NDKAgent events (kind 4199) by their IDs
                const fetchedAgents: NDKEvent[] = [];
                for (const eventId of agentEventIds) {
                    const agentEvent = ndk
                        ? await ndk.fetchEvent({
                              ids: [eventId],
                              kinds: [4199 as NDKKind],
                          })
                        : null;

                    if (agentEvent) {
                        fetchedAgents.push(agentEvent);
                    }
                }

                setAgents(fetchedAgents);
                setLoading(false);
            } catch (_error) {
                // console.error("Error fetching agent events:", error);
                setLoading(false);
            }
        }

        fetchAgents();
    }, [event, ndk]);

    if (loading) {
        return <div>Loading agents...</div>;
    }

    return (
        <div className="agent-discovery-card">
            <h3>Discovered Agents</h3>
            {agents.map((agent) => (
                <div key={agent.id} className="agent-item">
                    <h4>{agent.tagValue("title")}</h4>
                    <p>{agent.tagValue("description")}</p>
                    <p className="text-sm text-muted-foreground">Role: {agent.tagValue("role")}</p>
                </div>
            ))}
        </div>
    );
}
