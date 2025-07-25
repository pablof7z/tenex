import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation } from "@/conversations/types";
import type { NDKAgentLesson } from "@/events/NDKAgentLesson";
import { PromptBuilder } from "@/prompts/core/PromptBuilder";
import type { Tool } from "@/tools/types";
import "@/prompts/fragments/phase-definitions";
import "@/prompts/fragments/referenced-article";

export interface BuildSystemPromptOptions {
    // Required data
    agent: Agent;
    phase: Phase;
    projectTitle: string;
    projectRepository?: string;

    // Optional runtime data
    availableAgents?: Agent[];
    conversation?: Conversation;
    agentLessons?: Map<string, NDKAgentLesson[]>;
    mcpTools?: Tool[];
}

/**
 * Builds the system prompt for an agent using the exact same logic as production.
 * This is the single source of truth for system prompt generation.
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
    const {
        agent,
        phase,
        projectTitle,
        projectRepository = "No repository",
        availableAgents = [],
        conversation,
        agentLessons,
        mcpTools = [],
    } = options;

    // Build system prompt with all agent and phase context
    const systemPromptBuilder = new PromptBuilder()
        .add("agent-system-prompt", {
            agent,
            phase,
            projectTitle,
            projectRepository,
        })
        .add("available-agents", {
            agents: availableAgents,
            currentAgent: agent,
        });

    // Add referenced article context if present
    if (conversation?.metadata?.referencedArticle) {
        systemPromptBuilder.add("referenced-article", conversation.metadata.referencedArticle);
    }

    // Add project inventory context only for non-orchestrator agents
    if (!agent.isOrchestrator) {
        systemPromptBuilder.add("project-inventory-context", {
            phase,
        });

        // Add PROJECT.md fragment only for project-manager
        if (agent.slug === "project-manager") {
            systemPromptBuilder.add("project-md", {
                projectPath: process.cwd(),
                currentAgent: agent,
            });
        }
    }

    systemPromptBuilder
        .add("phase-definitions", {})
        .add("phase-context", {
            phase,
            phaseMetadata: conversation?.metadata,
            conversation,
        })
        .add("phase-constraints", {
            phase,
        })
        .add("retrieved-lessons", {
            agent,
            phase,
            conversation,
            agentLessons: agentLessons || new Map(),
        })
        .add("agent-tools", {
            agent,
        })
        .add("mcp-tools", {
            tools: mcpTools,
        });
    // .add("tool-use", {});

    // Add orchestrator-specific routing instructions for orchestrator agents
    if (agent.isOrchestrator) {
        systemPromptBuilder.add("orchestrator-routing-instructions", {});
    } else {
        // Add expertise boundaries for non-orchestrator agents
        systemPromptBuilder.add("expertise-boundaries", {
            agentRole: agent.role,
            isOrchestrator: false,
        });
    }

    return systemPromptBuilder.build();
}
