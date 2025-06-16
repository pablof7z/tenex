import type { AgentDefinition, ProjectContext } from "@/core/orchestration/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface PromptBuilder {
    buildAnalysisPrompt(event: NDKEvent, context: ProjectContext): string;
    buildCombinedAnalysisPrompt(
        event: NDKEvent,
        context: ProjectContext,
        availableAgents: Map<string, AgentDefinition>,
        maxTeamSize: number
    ): string;
}
