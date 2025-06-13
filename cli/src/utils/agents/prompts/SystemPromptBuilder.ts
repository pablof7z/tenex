import {
	AgentIdentityBuilder,
	AgentToAgentBuilder,
	ProjectContextBuilder,
	ProjectRulesBuilder,
	ProjectSpecsBuilder,
	StaticInstructionsBuilder,
	TeamInformationBuilder,
} from "./builders";
import type {
	PromptSection,
	PromptSectionBuilder,
	SystemPromptBuilderConfig,
	SystemPromptContext,
} from "./types";

/**
 * Centralized service for building system prompts for agents
 */
export class SystemPromptBuilder {
	private builders: Map<string, PromptSectionBuilder> = new Map();
	private config: Required<SystemPromptBuilderConfig>;

	constructor(config: SystemPromptBuilderConfig = {}) {
		// Set default configuration
		this.config = {
			includeStaticInstructions: config.includeStaticInstructions ?? true,
			includeToolInstructions: config.includeToolInstructions ?? true,
			includeTeamInformation: config.includeTeamInformation ?? true,
			includeAgentIdentity: config.includeAgentIdentity ?? true,
			includeProjectRules: config.includeProjectRules ?? true,
			includeProjectSpecs: config.includeProjectSpecs ?? true,
			customBuilders: config.customBuilders ?? [],
			excludeSections: config.excludeSections ?? [],
		};

		// Initialize default builders
		this.initializeDefaultBuilders();

		// Add custom builders
		for (const builder of this.config.customBuilders) {
			this.registerBuilder(builder);
		}
	}

	/**
	 * Initialize the default set of builders
	 */
	private initializeDefaultBuilders(): void {
		if (this.config.includeStaticInstructions) {
			this.registerBuilder(new StaticInstructionsBuilder());
		}
		if (this.config.includeAgentIdentity) {
			this.registerBuilder(new AgentIdentityBuilder());
		}
		this.registerBuilder(new ProjectContextBuilder());
		if (this.config.includeProjectSpecs) {
			// ProjectSpecsBuilder needs the spec cache, so we'll create it dynamically in build()
			// For now, we'll register a placeholder that gets replaced during build
		}
		if (this.config.includeTeamInformation) {
			this.registerBuilder(new TeamInformationBuilder());
		}
		if (this.config.includeProjectRules) {
			this.registerBuilder(new ProjectRulesBuilder());
		}
		this.registerBuilder(new AgentToAgentBuilder());
	}

	/**
	 * Register a section builder
	 */
	public registerBuilder(builder: PromptSectionBuilder): void {
		this.builders.set(builder.id, builder);
	}

	/**
	 * Unregister a section builder
	 */
	public unregisterBuilder(builderId: string): void {
		this.builders.delete(builderId);
	}

	/**
	 * Get all registered builders
	 */
	public getBuilders(): PromptSectionBuilder[] {
		return Array.from(this.builders.values());
	}

	/**
	 * Build the complete system prompt
	 */
	public build(context: SystemPromptContext): string {
		const sections = this.buildSections(context);
		return this.assembleSections(sections);
	}

	/**
	 * Build all sections based on context
	 */
	public buildSections(context: SystemPromptContext): PromptSection[] {
		const sections: PromptSection[] = [];

		// If agent has a predefined system prompt, use it exclusively
		if (context.agentConfig.systemPrompt) {
			return [
				{
					id: "predefined",
					name: "Predefined System Prompt",
					priority: 100,
					content: context.agentConfig.systemPrompt,
					enabled: true,
				},
			];
		}

		// Create a working set of builders, adding dynamic ones based on context
		const workingBuilders = new Map(this.builders);

		// Add ProjectSpecsBuilder if specs are available and enabled
		if (
			this.config.includeProjectSpecs &&
			context.specCache &&
			!this.config.excludeSections.includes("project-specs")
		) {
			workingBuilders.set(
				"project-specs",
				new ProjectSpecsBuilder(context.specCache),
			);
		}

		// Build sections using working builders
		for (const builder of workingBuilders.values()) {
			// Skip excluded sections
			if (this.config.excludeSections.includes(builder.id)) {
				continue;
			}

			try {
				const section = builder.build(context);
				if (section?.enabled) {
					sections.push(section);
				}
			} catch (error) {
				console.error(`Error building section ${builder.id}:`, error);
			}
		}

		// Sort sections by priority (higher priority first)
		sections.sort((a, b) => b.priority - a.priority);

		return sections;
	}

	/**
	 * Assemble sections into final prompt
	 */
	private assembleSections(sections: PromptSection[]): string {
		return sections
			.map((section) => section.content)
			.filter((content) => content.trim().length > 0)
			.join("\n\n");
	}

	/**
	 * Get a preview of what sections would be included
	 */
	public preview(context: SystemPromptContext): {
		sections: Array<{
			id: string;
			name: string;
			priority: number;
			length: number;
		}>;
		totalLength: number;
	} {
		const sections = this.buildSections(context);
		const sectionInfo = sections.map((section) => ({
			id: section.id,
			name: section.name,
			priority: section.priority,
			length: section.content.length,
		}));

		const totalLength = sections.reduce(
			(sum, section) => sum + section.content.length,
			0,
		);

		return {
			sections: sectionInfo,
			totalLength,
		};
	}

	/**
	 * Create a new instance with modified configuration
	 */
	public withConfig(
		config: Partial<SystemPromptBuilderConfig>,
	): SystemPromptBuilder {
		return new SystemPromptBuilder({
			...this.config,
			...config,
		});
	}

	/**
	 * Enable or disable specific sections
	 */
	public toggleSection(sectionId: string, enabled: boolean): void {
		if (enabled && this.config.excludeSections.includes(sectionId)) {
			this.config.excludeSections = this.config.excludeSections.filter(
				(id) => id !== sectionId,
			);
		} else if (!enabled && !this.config.excludeSections.includes(sectionId)) {
			this.config.excludeSections.push(sectionId);
		}
	}
}
