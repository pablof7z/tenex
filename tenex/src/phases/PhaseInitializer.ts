import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { logger } from "@tenex/shared";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";

export abstract class BasePhaseInitializer implements PhaseInitializer {
  abstract phase: Phase;

  abstract initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult>;

  protected log(message: string, data?: unknown) {
    logger.info(`[${this.phase.toUpperCase()} Phase] ${message}`, data);
  }

  protected logError(message: string, error: unknown) {
    logger.error(`[${this.phase.toUpperCase()} Phase] ${message}`, { error });
  }

  protected findAgentByRole(agents: Agent[], role: string): Agent | undefined {
    return agents.find((agent) => agent.role.toLowerCase().includes(role.toLowerCase()));
  }

  protected findAgentByExpertise(agents: Agent[], keywords: string[]): Agent | undefined {
    return agents.find((agent) =>
      keywords.some((keyword) => agent.expertise.toLowerCase().includes(keyword.toLowerCase()))
    );
  }
}
