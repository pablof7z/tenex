/**
 * System prompt composer - handles all prompt composition logic
 */

import type { AgentSummary, SpecSummary } from "@/agents/core/types";
import { AGENT_CATALOG_PROMPT } from "./agent-catalog";
import { BASE_AGENT_PROMPT } from "./base-agent";
import { SINGLE_AGENT_PROMPT } from "./single-agent";
import { SPEC_CATALOG_PROMPT } from "./spec-catalog";
import { TEAM_LEAD_PROMPT } from "./team-lead";
import { TOOL_INSTRUCTIONS_PROMPT } from "./tool-instructions";

export interface PromptContext {
    name: string;
    role: string;
    instructions: string;
    teamSize: number;
    toolDescriptions?: string;
    teamInfo?: string;
    stageInfo?: string;
    availableSpecs?: SpecSummary[];
    availableAgents?: AgentSummary[];
}

export class SystemPromptComposer {
    static composeAgentPrompt(context: PromptContext): string {
        // Choose base prompt based on team size
        let prompt =
            context.teamSize === 1
                ? SINGLE_AGENT_PROMPT(context.name, context.role, context.instructions)
                : BASE_AGENT_PROMPT(context.name, context.role, context.instructions);

        // Add spec catalog if available
        if (context.availableSpecs) {
            prompt += SPEC_CATALOG_PROMPT(context.availableSpecs);
        }

        // Add agent catalog if available
        if (context.availableAgents) {
            prompt += AGENT_CATALOG_PROMPT(context.availableAgents, context.name);
        }

        // Add tool instructions if available
        if (context.toolDescriptions) {
            prompt += TOOL_INSTRUCTIONS_PROMPT(context.toolDescriptions);
        }

        return prompt;
    }

    static composeTeamLeadPrompt(context: PromptContext): string {
        // For single-agent teams, use single agent prompt with stage info
        if (context.teamSize === 1) {
            let prompt = SINGLE_AGENT_PROMPT(context.name, context.role, context.instructions);

            if (context.stageInfo) {
                prompt += `\n\nCURRENT STAGE:\n${context.stageInfo}`;
            }

            if (context.availableSpecs) {
                prompt += SPEC_CATALOG_PROMPT(context.availableSpecs);
            }

            if (context.availableAgents) {
                prompt += AGENT_CATALOG_PROMPT(context.availableAgents, context.name);
            }

            if (context.toolDescriptions) {
                prompt += TOOL_INSTRUCTIONS_PROMPT(context.toolDescriptions);
            }

            return prompt;
        }

        // For multi-agent teams, use team lead prompt
        if (!context.teamInfo || !context.stageInfo) {
            throw new Error("Team info and stage info required for multi-agent team lead prompt");
        }

        let prompt = TEAM_LEAD_PROMPT(
            context.name,
            context.role,
            context.instructions,
            context.teamInfo,
            context.stageInfo
        );

        if (context.availableSpecs) {
            prompt += SPEC_CATALOG_PROMPT(context.availableSpecs);
        }

        if (context.availableAgents) {
            prompt += AGENT_CATALOG_PROMPT(context.availableAgents, context.name);
        }

        if (context.toolDescriptions) {
            prompt += TOOL_INSTRUCTIONS_PROMPT(context.toolDescriptions);
        }

        return prompt;
    }
}
