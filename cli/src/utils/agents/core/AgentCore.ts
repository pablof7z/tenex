import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { NDK } from "@nostr-dev-kit/ndk";
import type { AgentLogger } from "../../agentLogger";
import { createAgentLogger } from "../../agentLogger";
import type { AgentManager } from "../AgentManager";
import { SystemPromptBuilder } from "../prompts/SystemPromptBuilder";
import type { SystemPromptContext } from "../prompts/types";
import type { ToolRegistry } from "../tools/ToolRegistry";
import type { AgentConfig, LLMConfig } from "../types";

export class AgentCore {
	private name: string;
	private nsec: string;
	private signer: NDKPrivateKeySigner;
	private config: AgentConfig;
	private defaultLLMConfig?: LLMConfig;
	private logger: AgentLogger;
	private projectName: string;
	private toolRegistry?: ToolRegistry;
	private agentEventId?: string;
	private ndk?: NDK;
	private agentManager?: AgentManager;
	private systemPromptBuilder: SystemPromptBuilder;

	constructor(
		name: string,
		nsec: string,
		config: AgentConfig,
		projectName?: string,
		toolRegistry?: ToolRegistry,
		agentEventId?: string,
	) {
		this.name = name;
		this.nsec = nsec;
		this.signer = new NDKPrivateKeySigner(nsec);
		this.config = config;
		this.projectName = projectName || "unknown";
		this.logger = createAgentLogger(this.projectName, this.name);
		this.toolRegistry = toolRegistry;
		this.agentEventId = agentEventId;
		this.systemPromptBuilder = new SystemPromptBuilder();
	}

	getName(): string {
		return this.name;
	}

	getNsec(): string {
		return this.nsec;
	}

	getSigner(): NDKPrivateKeySigner {
		return this.signer;
	}

	getPubkey(): string {
		return this.signer.pubkey;
	}

	getConfig(): AgentConfig {
		return this.config;
	}

	setDefaultLLMConfig(config: LLMConfig): void {
		this.defaultLLMConfig = config;
	}

	getDefaultLLMConfig(): LLMConfig | undefined {
		return this.defaultLLMConfig;
	}

	setToolRegistry(toolRegistry: ToolRegistry): void {
		this.toolRegistry = toolRegistry;
	}

	getToolRegistry(): ToolRegistry | undefined {
		return this.toolRegistry;
	}

	getAgentEventId(): string | undefined {
		return this.agentEventId;
	}

	setNDK(ndk: NDK): void {
		this.ndk = ndk;
	}

	getNDK(): NDK | undefined {
		return this.ndk;
	}

	setAgentManager(agentManager: AgentManager): void {
		this.agentManager = agentManager;
	}

	getAgentManager(): AgentManager | undefined {
		return this.agentManager;
	}

	getLogger(): AgentLogger {
		return this.logger;
	}

	getProjectName(): string {
		return this.projectName;
	}

	/**
	 * Get the SystemPromptBuilder instance for advanced configuration
	 */
	getSystemPromptBuilder(): SystemPromptBuilder {
		return this.systemPromptBuilder;
	}

	/**
	 * Build system prompt with full context using SystemPromptBuilder
	 */
	buildSystemPromptWithContext(context: Partial<SystemPromptContext>): string {
		// Merge provided context with agent's own information
		const fullContext: SystemPromptContext = {
			agentName: this.name,
			agentConfig: this.config,
			...context,
		};

		return this.systemPromptBuilder.build(fullContext);
	}

	/**
	 * Legacy method for backward compatibility
	 * @deprecated Use buildSystemPromptWithContext for new code
	 */
	getSystemPrompt(
		additionalRules?: string,
		environmentContext?: string,
	): string {
		// For backward compatibility, parse the environment context to extract project info
		let projectInfo:
			| { id: string; title: string; repository?: string }
			| undefined;
		if (environmentContext?.includes("project:")) {
			// Basic parsing to extract project title from environment context
			const titleMatch = environmentContext.match(/project: "([^"]+)"/);
			const repoMatch = environmentContext.match(/Repository: (.+)/);
			if (titleMatch) {
				projectInfo = {
					id: "legacy",
					naddr: "legacy",
					title: titleMatch[1],
					repository: repoMatch?.[1],
					metadata: {
						title: titleMatch[1],
						naddr: "legacy",
					},
				};
			}
		}

		// Build context for SystemPromptBuilder
		const context: Partial<SystemPromptContext> = {
			projectInfo,
			additionalRules,
		};

		// If there's a predefined system prompt, the builder will handle it
		const prompt = this.buildSystemPromptWithContext(context);

		this.logger.debug(
			`Generated system prompt for ${this.name} using SystemPromptBuilder`,
		);
		return prompt;
	}
}
