import type { NDKEvent, NDKFilter, NDKKind } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import type { ToolContext, ToolDefinition } from "./types";

interface FindAgentParams {
    capabilities?: string;
    specialization?: string;
    keywords?: string;
    limit?: number;
}

interface AgentCandidate {
    eventId: string;
    pubkey: string;
    name: string;
    description: string;
    role: string;
    instructions: string;
    version: string;
    createdAt: number;
    score: number;
}

interface FindAgentResult {
    success: boolean;
    candidates: AgentCandidate[];
    error?: string;
    renderInChat: {
        type: "agent_discovery";
        data: {
            query: FindAgentParams;
            agentEventIds: string[]; // Only send event IDs
            message: string;
        };
    };
}

/**
 * Scores an agent based on how well it matches the search criteria
 */
function scoreAgent(agent: AgentCandidate, params: FindAgentParams): number {
    let score = 0;
    const searchText = [
        agent.description.toLowerCase(),
        agent.role.toLowerCase(),
        agent.instructions.toLowerCase(),
        agent.name.toLowerCase(),
    ].join(" ");

    // Check capabilities match
    if (params.capabilities) {
        const capWords = params.capabilities.toLowerCase().split(/\s+/);
        for (const word of capWords) {
            if (searchText.includes(word)) {
                score += 10;
            }
        }
    }

    // Check specialization match
    if (params.specialization) {
        const specWords = params.specialization.toLowerCase().split(/\s+/);
        for (const word of specWords) {
            if (searchText.includes(word)) {
                score += 8;
            }
        }
    }

    // Check keywords match
    if (params.keywords) {
        const keywords = params.keywords.toLowerCase().split(/\s+/);
        for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
                score += 5;
            }
        }
    }

    // Bonus for more detailed descriptions
    if (agent.description.length > 50) score += 2;
    if (agent.role.length > 100) score += 3;
    if (agent.instructions.length > 200) score += 5;

    return score;
}

/**
 * Extracts agent information from an NDKAgent event
 */
function extractAgentInfo(event: NDKEvent): AgentCandidate | null {
    try {
        const name = event.tagValue("title") || "";
        const description = event.tagValue("description") || "";
        const role = event.tagValue("role") || "";
        const instructions = event.tagValue("instructions") || "";
        const version = event.tagValue("version") || "1";

        if (!name || !description) {
            return null;
        }

        return {
            eventId: event.id,
            pubkey: event.pubkey,
            name,
            description,
            role,
            instructions,
            version,
            createdAt: event.created_at || 0,
            score: 0,
        };
    } catch (error) {
        logger.error("Error extracting agent info:", error);
        return null;
    }
}

export const findAgentTool: ToolDefinition = {
    name: "find_agent",
    description:
        "Search for specialized AI agents that can be added to the project. Use this when the user requests functionality that would benefit from a specialized agent.",
    parameters: [
        {
            name: "capabilities",
            type: "string",
            description:
                "The capabilities or skills the agent should have (e.g., 'architecture design', 'security audit', 'performance optimization')",
            required: false,
        },
        {
            name: "specialization",
            type: "string",
            description:
                "The domain or technology specialization (e.g., 'React', 'blockchain', 'machine learning', 'DevOps')",
            required: false,
        },
        {
            name: "keywords",
            type: "string",
            description: "Additional keywords to search for in agent descriptions",
            required: false,
        },
        {
            name: "limit",
            type: "number",
            description: "Maximum number of agents to return (default: 5)",
            required: false,
        },
    ],
    execute: async (params: FindAgentParams, context?: ToolContext): Promise<FindAgentResult> => {
        // Check if this is the default agent
        if (!context?.agent || context.agent.getName() !== "default") {
            return {
                success: false,
                candidates: [],
                error: "Only the default agent can search for other agents",
                renderInChat: {
                    type: "agent_discovery",
                    data: {
                        query: params,
                        agentEventIds: [],
                        message: "Error: Only the default agent can search for other agents",
                    },
                },
            };
        }

        if (!context.ndk) {
            return {
                success: false,
                candidates: [],
                error: "NDK client not available",
                renderInChat: {
                    type: "agent_discovery",
                    data: {
                        query: params,
                        agentEventIds: [],
                        message: "Error: NDK client not available",
                    },
                },
            };
        }

        try {
            logger.info("Searching for agents with criteria:", params);

            // Build filter for NDKAgent events
            const filter: NDKFilter = {
                kinds: [4199 as NDKKind], // NDKAgent event kind
                limit: 100, // Fetch more than needed to allow for scoring/filtering
            };

            // Fetch NDKAgent events
            const events = await context.ndk.fetchEvents(filter);
            logger.info(`Found ${events.size} total NDKAgent events`);

            // Extract and score agents
            const candidates: AgentCandidate[] = [];

            for (const event of events) {
                const agentInfo = extractAgentInfo(event);
                if (agentInfo) {
                    // Calculate relevance score
                    agentInfo.score = scoreAgent(agentInfo, params);

                    // Only include agents with some relevance
                    if (
                        agentInfo.score > 0 ||
                        (!params.capabilities && !params.specialization && !params.keywords)
                    ) {
                        candidates.push(agentInfo);
                    }
                }
            }

            // Sort by score (highest first) and then by creation date (newest first)
            candidates.sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                return b.createdAt - a.createdAt;
            });

            // Limit results
            const limit = params.limit || 5;
            const topCandidates = candidates.slice(0, limit);

            logger.info(`Returning ${topCandidates.length} agent candidates`);

            // Build descriptive message
            let message = "";
            if (topCandidates.length === 0) {
                message = "No agents found matching your criteria.";
            } else if (params.capabilities || params.specialization) {
                message = `Found ${topCandidates.length} agent${topCandidates.length !== 1 ? "s" : ""} that may help with ${params.capabilities || params.specialization}.`;
            } else {
                message = `Found ${topCandidates.length} available agent${topCandidates.length !== 1 ? "s" : ""}.`;
            }

            // Extract just the event IDs for the web client to fetch
            const agentEventIds = topCandidates.map((candidate) => candidate.eventId);

            return {
                success: true,
                candidates: topCandidates,
                renderInChat: {
                    type: "agent_discovery",
                    data: {
                        query: params,
                        agentEventIds,
                        message,
                    },
                },
            };
        } catch (error) {
            logger.error("Error searching for agents:", error);
            return {
                success: false,
                candidates: [],
                error: error instanceof Error ? error.message : "Unknown error",
                renderInChat: {
                    type: "agent_discovery",
                    data: {
                        query: params,
                        agentEventIds: [],
                        message: `Error searching for agents: ${error instanceof Error ? error.message : "Unknown error"}`,
                    },
                },
            };
        }
    },
};
