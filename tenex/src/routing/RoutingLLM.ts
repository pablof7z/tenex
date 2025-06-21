import type { LLMService } from "@/llm";
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
import { logger } from "@tenex/shared";
import { Message } from "multi-llm-ts";
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
      logger.warn("Failed to get project context for routing", {
        error,
        projectPath: this.projectPath,
      });
      return undefined;
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

      const prompt = RoutingPromptBuilder.newConversation({
        message: event.content,
        agents: agentSummaries,
        projectContext,
      });

      const systemPrompt = getRoutingSystemPrompt(projectContext);
      const messages = [new Message("system", systemPrompt), new Message("user", prompt)];

      // Log the full request
      logger.info("RoutingLLM.routeNewConversation - Sending to LLM", {
        systemPrompt,
        userPrompt: prompt,
        configName: this.configName,
        messageContent: event.content,
        availableAgentsCount: availableAgents.length,
      });

      const response = await this.llmService.complete(this.configName, messages);

      // Log the raw response
      logger.info("RoutingLLM.routeNewConversation - Received from LLM", {
        rawResponse: response.content,
        model: response.model,
        usage: response.usage,
      });

      const decision = extractJSON<RoutingDecision>(response.content);

      if (!decision) {
        logger.warn("Failed to parse routing decision, using fallback", {
          rawResponse: response.content,
        });
        return await this.handleRoutingFailure(event, availableAgents);
      }

      logger.info("RoutingLLM.routeNewConversation - Parsed decision", {
        decision,
        phase: decision.phase,
        confidence: decision.confidence,
      });

      return decision;
    } catch (error) {
      logger.error("Error in routeNewConversation", { error });
      return await this.handleRoutingFailure(event, availableAgents);
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

      // First check if we should transition phases
      const transitionDecision = await this.checkPhaseTransition(conversation, lastMessage);

      if (transitionDecision.shouldTransition && transitionDecision.targetPhase) {
        logger.info("RoutingLLM.routeNextAction - Phase transition decided", {
          fromPhase: conversation.phase,
          toPhase: transitionDecision.targetPhase,
          reasoning: transitionDecision.reasoning,
        });
        return {
          phase: transitionDecision.targetPhase,
          reasoning: transitionDecision.reasoning,
        };
      }

      // If no transition, select the next agent for current phase
      const agentSummaries: AgentSummary[] = availableAgents.map((agent) => ({
        name: agent.name,
        pubkey: agent.pubkey,
        role: agent.role,
        expertise: agent.expertise,
      }));

      const agentDecision = await this.selectAgent(conversation.phase, lastMessage, agentSummaries);

      const result = {
        phase: conversation.phase,
        nextAgent: agentDecision.agentPubkey,
        reasoning: agentDecision.reasoning,
      };

      logger.info("RoutingLLM.routeNextAction - Agent selection decided", {
        phase: conversation.phase,
        selectedAgent: availableAgents.find((a) => a.pubkey === agentDecision.agentPubkey)?.name,
        reasoning: agentDecision.reasoning,
      });

      return result;
    } catch (error) {
      logger.error("Error in routeNextAction", { error });
      return {
        phase: conversation.phase,
        reasoning: "Error occurred, maintaining current phase",
      };
    }
  }

  private async checkPhaseTransition(
    conversation: Conversation,
    lastMessage: string
  ): Promise<PhaseTransitionDecision> {
    const prompt = RoutingPromptBuilder.phaseTransition({
      currentPhase: conversation.phase,
      conversationSummary: conversation.metadata.summary,
      phaseHistory: lastMessage, // Simplified for now
    });

    const systemPrompt = getPhaseTransitionSystemPrompt();
    const messages = [new Message("system", systemPrompt), new Message("user", prompt)];

    // Log the full request
    logger.info("RoutingLLM.checkPhaseTransition - Sending to LLM", {
      systemPrompt,
      userPrompt: prompt,
      configName: this.configName,
      currentPhase: conversation.phase,
      conversationId: conversation.id,
    });

    const response = await this.llmService.complete(this.configName, messages);

    // Log the raw response
    logger.info("RoutingLLM.checkPhaseTransition - Received from LLM", {
      rawResponse: response.content,
      model: response.model,
      usage: response.usage,
    });

    const decision = extractJSON<PhaseTransitionDecision>(response.content);

    if (!decision) {
      logger.warn("Failed to parse phase transition decision", {
        rawResponse: response.content,
      });
      return {
        shouldTransition: false,
        reasoning: "Unable to parse transition decision",
      };
    }

    logger.info("RoutingLLM.checkPhaseTransition - Parsed decision", {
      decision,
      shouldTransition: decision.shouldTransition,
      targetPhase: decision.targetPhase,
    });

    return decision;
  }

  private async selectAgent(
    currentPhase: string,
    taskContext: string,
    agents: AgentSummary[]
  ): Promise<AgentSelectionDecision> {
    const projectContext = await this.getProjectContextString();

    const prompt = RoutingPromptBuilder.selectAgent({
      currentPhase,
      message: taskContext,
      agents,
      projectContext,
    });

    const systemPrompt = getAgentSelectionSystemPrompt();
    const messages = [new Message("system", systemPrompt), new Message("user", prompt)];

    // Log the full request
    logger.info("RoutingLLM.selectAgent - Sending to LLM", {
      systemPrompt,
      userPrompt: prompt,
      configName: this.configName,
      currentPhase,
      agentCount: agents.length,
      agentNames: agents.map((a) => a.name),
    });

    const response = await this.llmService.complete(this.configName, messages);

    // Log the raw response
    logger.info("RoutingLLM.selectAgent - Received from LLM", {
      rawResponse: response.content,
      model: response.model,
      usage: response.usage,
    });

    const decision = extractJSON<AgentSelectionDecision>(response.content);

    if (!decision || !decision.agentPubkey) {
      logger.warn("Failed to parse agent selection decision", {
        rawResponse: response.content,
        parsedDecision: decision,
      });
      // Default to first agent if parsing fails
      return {
        agentPubkey: agents[0]?.pubkey || "",
        reasoning: "Defaulting to first available agent",
      };
    }

    logger.info("RoutingLLM.selectAgent - Parsed decision", {
      decision,
      selectedAgent: agents.find((a) => a.pubkey === decision.agentPubkey)?.name,
    });

    return decision;
  }

  async handleRoutingFailure(event: NDKEvent, availableAgents: Agent[]): Promise<RoutingDecision> {
    try {
      const agentSummaries: AgentSummary[] = availableAgents.map((agent) => ({
        name: agent.name,
        pubkey: agent.pubkey,
        role: agent.role,
        expertise: agent.expertise,
      }));

      const prompt = RoutingPromptBuilder.fallbackRouting({
        message: event.content,
        currentPhase: undefined,
        agents: agentSummaries,
      });

      const systemPrompt = getFallbackRoutingSystemPrompt();
      const messages = [new Message("system", systemPrompt), new Message("user", prompt)];

      // Log the full request
      logger.info("RoutingLLM.handleRoutingFailure - Sending to LLM", {
        systemPrompt,
        userPrompt: prompt,
        configName: this.configName,
        messageContent: event.content,
        availableAgentsCount: availableAgents.length,
      });

      const response = await this.llmService.complete(this.configName, messages);

      // Log the raw response
      logger.info("RoutingLLM.handleRoutingFailure - Received from LLM", {
        rawResponse: response.content,
        model: response.model,
        usage: response.usage,
      });

      const fallback = extractJSON<FallbackRoutingDecision>(response.content);

      if (!fallback) {
        logger.warn("Failed to parse fallback routing decision", {
          rawResponse: response.content,
        });
        // Ultimate fallback - start in chat phase
        return {
          phase: "chat",
          reasoning: "Unable to determine routing, defaulting to chat phase",
        };
      }

      logger.info("RoutingLLM.handleRoutingFailure - Parsed decision", {
        fallback,
        action: fallback.action,
      });

      // Convert fallback decision to routing decision
      if (fallback.action === "set_phase" && fallback.phase) {
        return {
          phase: fallback.phase,
          reasoning: fallback.reasoning,
        };
      }
      if (fallback.action === "handoff" && fallback.agentPubkey) {
        return {
          phase: "chat", // Default phase for handoff
          nextAgent: fallback.agentPubkey,
          reasoning: fallback.reasoning,
        };
      }

      // Default to chat phase
      return {
        phase: "chat",
        reasoning: fallback.reasoning || "Defaulting to chat phase",
      };
    } catch (error) {
      logger.error("Error in fallback routing", { error });
      return {
        phase: "chat",
        reasoning: "Fallback routing failed, defaulting to chat",
      };
    }
  }
}
