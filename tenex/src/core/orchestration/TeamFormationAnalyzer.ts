import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { ProjectContext, RequestAnalysis } from "./types";

export interface TeamFormationAnalyzer {
    analyzeRequest(event: NDKEvent, context: ProjectContext): Promise<RequestAnalysis>;
}
