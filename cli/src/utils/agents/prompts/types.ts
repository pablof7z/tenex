import type { ProjectInfo } from "../../../types";
import type { CachedRule } from "../../RulesManager";
import type { AgentConfig } from "../types";
import type { SpecCache } from "./SpecCache";

/**
 * Represents a section of the system prompt
 */
export interface PromptSection {
	/** Unique identifier for the section */
	id: string;
	/** Display name for the section */
	name: string;
	/** Priority for ordering (higher = earlier in prompt) */
	priority: number;
	/** The actual content of this section */
	content: string;
	/** Whether this section is enabled */
	enabled: boolean;
}

/**
 * Context required to build the system prompt
 */
export interface SystemPromptContext {
	/** The agent this prompt is for */
	agentName: string;
	/** Agent configuration */
	agentConfig: AgentConfig;
	/** Project information */
	projectInfo?: ProjectInfo;
	/** Available tools for this agent */
	availableTools?: string[];
	/** Other agents in the system */
	otherAgents?: Array<{
		name: string;
		description?: string;
		role?: string;
	}>;
	/** Project-specific rules */
	projectRules?: CachedRule[];
	/** Additional custom rules */
	additionalRules?: string;
	/** Whether this is an agent-to-agent communication */
	isAgentToAgent?: boolean;
	/** Cached specification documents */
	specCache?: SpecCache;
}

/**
 * Builder for a specific prompt section
 */
export interface PromptSectionBuilder {
	/** Unique identifier for this builder */
	id: string;
	/** Display name for this builder */
	name: string;
	/** Default priority for sections created by this builder */
	defaultPriority: number;
	/** Build the section content based on context */
	build(context: SystemPromptContext): PromptSection | null;
}

/**
 * Configuration for the SystemPromptBuilder
 */
export interface SystemPromptBuilderConfig {
	/** Whether to include static TENEX instructions */
	includeStaticInstructions?: boolean;
	/** Whether to include tool instructions */
	includeToolInstructions?: boolean;
	/** Whether to include team information */
	includeTeamInformation?: boolean;
	/** Whether to include agent identity */
	includeAgentIdentity?: boolean;
	/** Whether to include project rules */
	includeProjectRules?: boolean;
	/** Whether to include project specifications */
	includeProjectSpecs?: boolean;
	/** Custom section builders to include */
	customBuilders?: PromptSectionBuilder[];
	/** Section IDs to exclude */
	excludeSections?: string[];
}
