import { DEFAULT_SYSTEM_INSTRUCTIONS } from "../constants";
import type {
	PromptSection,
	PromptSectionBuilder,
	SystemPromptContext,
} from "../types";

/**
 * Builds static TENEX system instructions that apply to all agents
 */
export class StaticInstructionsBuilder implements PromptSectionBuilder {
	id = "static-instructions";
	name = "Static TENEX Instructions";
	defaultPriority = 100;

	build(context: SystemPromptContext): PromptSection {
		return {
			id: this.id,
			name: this.name,
			priority: this.defaultPriority,
			content: DEFAULT_SYSTEM_INSTRUCTIONS,
			enabled: true,
		};
	}
}
