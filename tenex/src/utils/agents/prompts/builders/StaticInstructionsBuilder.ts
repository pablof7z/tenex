import { DEFAULT_SYSTEM_INSTRUCTIONS } from "@/utils/agents/prompts/constants";
import type {
    PromptSection,
    PromptSectionBuilder,
    SystemPromptContext,
} from "@/utils/agents/prompts/types";

/**
 * Builds static TENEX system instructions that apply to all agents
 */
export class StaticInstructionsBuilder implements PromptSectionBuilder {
    id = "static-instructions";
    name = "Static TENEX Instructions";
    defaultPriority = 100;

    build(_context: SystemPromptContext): PromptSection {
        return {
            id: this.id,
            name: this.name,
            priority: this.defaultPriority,
            content: DEFAULT_SYSTEM_INSTRUCTIONS,
            enabled: true,
        };
    }
}
