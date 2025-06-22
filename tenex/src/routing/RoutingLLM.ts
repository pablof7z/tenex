import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { LLMService, Message } from "@/core/llm/types";
import {
  RoutingPromptBuilder,
  extractJSON,
  getAgentSelectionSystemPrompt,
  getFallbackRoutingSystemPrompt,
  getPhaseTransitionSystemPrompt,
  getRoutingSystemPrompt,
} from "@/prompts";
import type { Agent } from "@/types/agent";
import type { Conversation } from "@/types/conversation";
import type { AgentSummary } from "@/types/routing";
import { formatProjectContextForPrompt, getProjectContext } from "@/utils/project";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import { projectContext, configService } from "@/services";
import type {
  AgentSelectionDecision,
  FallbackRoutingDecision,
  PhaseTransitionDecision,
  RoutingContext,
  RoutingDecision,
} from "./types";

export class RoutingLLM {
  constructor(
    private llmService: LLMService,
    private configName = "default",
    private projectPath?: string
  ) {}

  private async getProjectContextString(): Promise<string | undefined> {
    if (!this.projectPath) {
      return undefined;
    }

    try {
      const projectContext = await getProjectContext(this.projectPath);
      return formatProjectContextForPrompt(projectContext);
    } catch (error) {
      logger.error("Failed to get project context", { error });
      return undefined;
    }
  }

  /**
   * Get project inventory content
   */
  private async getProjectInventory(): Promise<string | null> {
    if (!this.projectPath) {
      return null;
    }

    try {
      // Get inventory path from config
      const { config } = await configService.loadConfig(this.projectPath);
      const inventoryPath = config?.paths?.inventory || "context/INVENTORY.md";
      const fullPath = path.join(this.projectPath, inventoryPath);

      // Try to read inventory file
      const inventory = await fs.readFile(fullPath, "utf-8");
      logger.debug("Loaded project inventory for routing");

      return inventory;
    } catch (error) {
      logger.debug("No project inventory found", {
        error,
        projectPath: this.projectPath,
      });
      return null;
    }
  }

  async routeNewConversation(event: NDKEvent, availableAgents: Agent[]): Promise<RoutingDecision> {
    try {
      const agentSummaries: AgentSummary[] = availableAgents.map((agent) => ({
        name: agent.name,
        pubkey: agent.pubkey,
        role: agent.role,
        expertise: agent.expertise,
      }));

      const projectContext = await this.getProjectContextString();
      const projectInventory = await this.getProjectInventory();

      const prompt = RoutingPromptBuilder.newConversation({
        message: event.content,
        agents: agentSummaries,
        projectContext,
        projectInventory: projectInventory || undefined,
      });

      const systemPrompt = getRoutingSystemPrompt(projectContext);
      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      // Log the full request
      logger.info("RoutingLLM.routeNewConversation - Sending to LLM", {
        systemPrompt,
        userPrompt: prompt,
        configName: this.configName,
        messageContent: event.content,
        availableAgentsCount: availableAgents.length,
        hasInventory: !!projectInventory,
      });

      const response = await this.llmService.complete({ messages });

      // Log the raw response
      logger.info("RoutingLLM.routeNewConversation - Received response", {
        response,
        configName: this.configName,
      });

      const decision = this.parseRoutingDecision(response.content, availableAgents);

      // Log the parsed decision
      logger.info("RoutingLLM.routeNewConversation - Parsed decision", {
        decision,
        configName: this.configName,
      });

      return decision;
    } catch (error) {
      logger.error("Failed to route new conversation", { error });
      throw error;
    }
  }

  async selectAgent(
    context: RoutingContext,
    availableAgents: Agent[]
  ): Promise<AgentSelectionDecision> {
    try {
      const agentSummaries: AgentSummary[] = availableAgents.map((agent) => ({
        name: agent.name,
        pubkey: agent.pubkey,
        role: agent.role,
        expertise: agent.expertise,
      }));

      const projectContext = await this.getProjectContextString();
      const projectInventory = await this.getProjectInventory();

      const prompt = RoutingPromptBuilder.selectAgent({
        message: context.lastMessage,
        currentPhase: context.currentPhase,
        phaseHistory: context.phaseHistory,
        agents: agentSummaries,
        conversationSummary: context.conversationSummary,
        projectContext,
        projectInventory: projectInventory || undefined,
      });

      const systemPrompt = getAgentSelectionSystemPrompt();
      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      logger.info("RoutingLLM.selectAgent - Sending to LLM", {
        systemPrompt,
        userPrompt: prompt,
        configName: this.configName,
        currentPhase: context.currentPhase,
        availableAgentsCount: availableAgents.length,
        hasInventory: !!projectInventory,
      });

      const response = await this.llmService.complete({ messages });

      logger.info("RoutingLLM.selectAgent - Received response", {
        response,
        configName: this.configName,
      });

      return this.parseAgentSelection(response.content, availableAgents);
    } catch (error) {
      logger.error("Failed to select agent", { error });
      throw error;
    }
  }

  async routeNextAction(
    conversation: Conversation,
    lastMessage: string,
    availableAgents: Agent[]
  ): Promise<RoutingDecision> {
    try {
      logger.info("RoutingLLM.routeNextAction - Starting", {
        conversationId: conversation.id,
        currentPhase: conversation.phase,
        availableAgentsCount: availableAgents.length,
      });

      // Build routing context
      const context: RoutingContext = {
        conversationId: conversation.id,
        currentPhase: conversation.phase,
        lastMessage,
        phaseHistory: conversation.metadata.phaseHistory || "",
        conversationSummary: conversation.metadata.summary || "",
      };

      // First check if we should transition phases
      const transitionDecision = await this.determinePhaseTransition(conversation, context);

      if (transitionDecision.shouldTransition && transitionDecision.targetPhase) {
        logger.info("RoutingLLM.routeNextAction - Phase transition decided", {
          fromPhase: conversation.phase,
          toPhase: transitionDecision.targetPhase,
          reasoning: transitionDecision.reasoning,
        });
        return {
          phase: transitionDecision.targetPhase,
          reasoning: transitionDecision.reasoning,
          confidence: transitionDecision.confidence,
        };
      }

      // If no transition, select the next agent for current phase
      const agentDecision = await this.selectAgent(context, availableAgents);

      const result: RoutingDecision = {
        phase: conversation.phase,
        nextAgent: agentDecision.selectedAgent.pubkey,
        reasoning: agentDecision.reasoning,
        confidence: agentDecision.confidence,
      };

      logger.info("RoutingLLM.routeNextAction - Agent selection decided", {
        phase: conversation.phase,
        selectedAgent: agentDecision.selectedAgent.name,
        reasoning: agentDecision.reasoning,
      });

      return result;
    } catch (error) {
      logger.error("Error in routeNextAction", { error });
      return {
        phase: conversation.phase,
        reasoning: "Error occurred, maintaining current phase",
        confidence: 0.5,
      };
    }
  }

  async determinePhaseTransition(
    conversation: Conversation,
    context: RoutingContext
  ): Promise<PhaseTransitionDecision> {
    try {
      const projectContext = await this.getProjectContextString();
      const projectInventory = await this.getProjectInventory();

      const prompt = RoutingPromptBuilder.phaseTransition({
        currentPhase: context.currentPhase,
        phaseHistory: context.phaseHistory,
        conversationSummary: context.conversationSummary,
        projectContext,
        projectInventory: projectInventory || undefined,
      });

      const systemPrompt = getPhaseTransitionSystemPrompt();
      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      logger.info("RoutingLLM.determinePhaseTransition - Sending to LLM", {
        systemPrompt,
        userPrompt: prompt,
        configName: this.configName,
        currentPhase: context.currentPhase,
        phaseHistory: context.phaseHistory,
        hasInventory: !!projectInventory,
      });

      const response = await this.llmService.complete({ messages });

      logger.info("RoutingLLM.determinePhaseTransition - Received response", {
        response,
        configName: this.configName,
      });

      return this.parsePhaseTransition(response.content);
    } catch (error) {
      logger.error("Failed to determine phase transition", { error });
      throw error;
    }
  }

  async fallbackRoute(event: NDKEvent, availableAgents: Agent[]): Promise<FallbackRoutingDecision> {
    try {
      const agentSummaries: AgentSummary[] = availableAgents.map((agent) => ({
        name: agent.name,
        pubkey: agent.pubkey,
        role: agent.role,
        expertise: agent.expertise,
      }));

      const projectContext = await this.getProjectContextString();
      const projectInventory = await this.getProjectInventory();

      const prompt = RoutingPromptBuilder.fallback({
        message: event.content,
        agents: agentSummaries,
        projectContext,
        projectInventory: projectInventory || undefined,
      });

      const systemPrompt = getFallbackRoutingSystemPrompt();
      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      logger.info("RoutingLLM.fallbackRoute - Sending to LLM", {
        systemPrompt,
        userPrompt: prompt,
        configName: this.configName,
        messageContent: event.content,
        availableAgentsCount: availableAgents.length,
        hasInventory: !!projectInventory,
      });

      const response = await this.llmService.complete({ messages });

      logger.info("RoutingLLM.fallbackRoute - Received response", {
        response,
        configName: this.configName,
      });

      return this.parseFallbackDecision(response.content, availableAgents);
    } catch (error) {
      logger.error("Failed to perform fallback routing", { error });
      throw error;
    }
  }

  private parseRoutingDecision(response: string, availableAgents: Agent[]): RoutingDecision {
    try {
      const parsed = extractJSON<{
        phase: string;
        reasoning?: string;
        confidence?: number;
        metadata?: Record<string, unknown>;
      }>(response);
      if (!parsed) {
        throw new Error("Failed to extract JSON from response");
      }

      const phase = this.validatePhase(parsed.phase);
      const confidence = this.validateConfidence(parsed.confidence);

      return {
        phase,
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence,
        metadata: parsed.metadata || {},
      };
    } catch (error) {
      logger.error("Failed to parse routing decision", { response, error });
      // Fallback to chat phase
      return {
        phase: "chat",
        reasoning: "Failed to parse routing decision, defaulting to chat phase",
        confidence: 0.5,
        metadata: { error: "parse_error" },
      };
    }
  }

  private parseAgentSelection(response: string, availableAgents: Agent[]): AgentSelectionDecision {
    try {
      const parsed = extractJSON<{
        agent: string;
        reasoning?: string;
        confidence?: number;
        alternatives?: string[];
      }>(response);
      if (!parsed) {
        throw new Error("Failed to extract JSON from response");
      }

      // Find the selected agent
      const selectedAgent = availableAgents.find(
        (agent) => agent.name === parsed.agent || agent.pubkey === parsed.agent
      );

      if (!selectedAgent) {
        throw new Error(`Selected agent not found: ${parsed.agent}`);
      }

      return {
        selectedAgent,
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence: this.validateConfidence(parsed.confidence),
        alternativeAgents: this.parseAlternativeAgents(parsed.alternatives, availableAgents),
      };
    } catch (error) {
      logger.error("Failed to parse agent selection", { response, error });
      // Fallback to first available agent
      const firstAgent = availableAgents[0];
      if (!firstAgent) {
        throw new Error("No available agents to select from");
      }
      return {
        selectedAgent: firstAgent,
        reasoning: "Failed to parse agent selection, using first available agent",
        confidence: 0.3,
        alternativeAgents: availableAgents.slice(1, 3),
      };
    }
  }

  private parsePhaseTransition(response: string): PhaseTransitionDecision {
    try {
      const parsed = extractJSON<{
        shouldTransition: boolean;
        targetPhase?: string;
        reasoning?: string;
        confidence?: number;
        conditions?: string[];
      }>(response);
      if (!parsed) {
        throw new Error("Failed to extract JSON from response");
      }

      return {
        shouldTransition: Boolean(parsed.shouldTransition),
        targetPhase: parsed.targetPhase ? this.validatePhase(parsed.targetPhase) : undefined,
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence: this.validateConfidence(parsed.confidence),
        conditions: parsed.conditions || [],
      };
    } catch (error) {
      logger.error("Failed to parse phase transition", { response, error });
      // Default to no transition
      return {
        shouldTransition: false,
        reasoning: "Failed to parse phase transition decision",
        confidence: 0.3,
        conditions: [],
      };
    }
  }

  private parseFallbackDecision(
    response: string,
    availableAgents: Agent[]
  ): FallbackRoutingDecision {
    try {
      const parsed = extractJSON<{
        agent: string;
        phase: string;
        reasoning?: string;
        confidence?: number;
        isUncertain?: boolean;
      }>(response);
      if (!parsed) {
        throw new Error("Failed to extract JSON from response");
      }

      const selectedAgent = availableAgents.find(
        (agent) => agent.name === parsed.agent || agent.pubkey === parsed.agent
      );

      if (!selectedAgent) {
        throw new Error(`Selected agent not found: ${parsed.agent}`);
      }

      return {
        selectedAgent,
        phase: this.validatePhase(parsed.phase),
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence: this.validateConfidence(parsed.confidence),
        isUncertain: parsed.isUncertain !== false,
      };
    } catch (error) {
      logger.error("Failed to parse fallback decision", { response, error });
      // Ultimate fallback
      const firstAgent = availableAgents[0];
      if (!firstAgent) {
        throw new Error("No available agents for fallback decision");
      }
      return {
        selectedAgent: firstAgent,
        phase: "chat",
        reasoning: "Failed to parse fallback decision, using defaults",
        confidence: 0.2,
        isUncertain: true,
      };
    }
  }

  private validatePhase(phase: string): "chat" | "plan" | "execute" | "review" | "chores" {
    const validPhases = ["chat", "plan", "execute", "review", "chores"];
    if (validPhases.includes(phase)) {
      return phase as "chat" | "plan" | "execute" | "review" | "chores";
    }
    logger.warn("Invalid phase detected, defaulting to chat", { phase });
    return "chat";
  }

  private validateConfidence(confidence: unknown): number {
    const num = Number(confidence);
    if (Number.isNaN(num)) return 0.5;
    return Math.max(0, Math.min(1, num));
  }

  private parseAlternativeAgents(alternatives: unknown, availableAgents: Agent[]): Agent[] {
    if (!Array.isArray(alternatives)) return [];

    return alternatives
      .map((alt: string) =>
        availableAgents.find((agent) => agent.name === alt || agent.pubkey === alt)
      )
      .filter((agent): agent is Agent => agent !== undefined)
      .slice(0, 3); // Maximum 3 alternatives
  }
}
