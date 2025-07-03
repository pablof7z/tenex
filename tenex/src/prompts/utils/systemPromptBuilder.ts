import { PromptBuilder } from "@/prompts/core/PromptBuilder";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/phases";
import type { Conversation } from "@/conversations/types";
import type { NDKAgentLesson } from "@/events/NDKAgentLesson";
import type { Tool } from "@/tools/types";

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
    claudeCodeReport?: string;
    inventoryContent?: string;
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
        claudeCodeReport,
        inventoryContent
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
            currentAgentPubkey: agent.pubkey,
        })
        .add("project-inventory-context", {
            phase,
            inventoryContent, // Pass content directly instead of having fragment read file
        })
        // Move phase context and constraints to system prompt
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
        .add("learn-tool-directive", {
            hasLearnTool: agent.tools?.includes("learn") ?? false,
        })
        .add("mcp-tools", {
            tools: mcpTools,
        });

    // Add PM-specific routing instructions for PM agents
    if (agent.isPMAgent) {
        systemPromptBuilder.add("pm-routing-instructions", {}).add("pm-handoff-guidance", {});

        // Add Claude Code report fragment if we have one
        if (claudeCodeReport) {
            systemPromptBuilder.add("claude-code-report", {
                claudeCodeReport,
            });
        }
    } else {
        // Add expertise boundaries for non-PM agents
        systemPromptBuilder.add("expertise-boundaries", {
            agentRole: agent.role,
            isPMAgent: false
        });
    }

    return systemPromptBuilder.build();
}