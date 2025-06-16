import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type { ProjectContext } from "./types";

export interface PromptBuilder {
    buildAnalysisPrompt(event: NDKEvent, context: ProjectContext): string;
}
