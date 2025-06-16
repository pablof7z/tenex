import type {
    AgentDefinition,
    CombinedAnalysisResponse,
    ProjectContext,
    RequestAnalysis,
} from "@/core/orchestration/types";
import type { NDKEvent } from "@nostr-dev-kit/ndk";

export interface TeamFormationAnalyzer {
    analyzeRequest(event: NDKEvent, context: ProjectContext): Promise<RequestAnalysis>;
    analyzeAndFormTeam(
        event: NDKEvent,
        context: ProjectContext,
        availableAgents: Map<string, AgentDefinition>
    ): Promise<CombinedAnalysisResponse>;
}
