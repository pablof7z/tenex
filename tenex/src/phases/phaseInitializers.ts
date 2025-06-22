import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { ChatPhaseInitializer } from "./ChatPhaseInitializer";
import { ChoresPhaseInitializer } from "./ChoresPhaseInitializer";
import { ExecutePhaseInitializer } from "./ExecutePhaseInitializer";
import { PlanPhaseInitializer } from "./PlanPhaseInitializer";
import { ReviewPhaseInitializer } from "./ReviewPhaseInitializer";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";

// Direct mapping of phase initializers
const phaseInitializers: Record<Phase, PhaseInitializer> = {
  chat: new ChatPhaseInitializer(),
  plan: new PlanPhaseInitializer(),
  execute: new ExecutePhaseInitializer(),
  review: new ReviewPhaseInitializer(),
  chores: new ChoresPhaseInitializer(),
};

/**
 * Initialize a phase with the appropriate initializer
 */
export async function initializePhase(
  phase: Phase,
  conversation: ConversationState,
  availableAgents: Agent[]
): Promise<PhaseInitializationResult> {
  const initializer = phaseInitializers[phase];
  if (!initializer) {
    throw new Error(`No initializer found for phase: ${phase}`);
  }
  return initializer.initialize(conversation, availableAgents);
}
