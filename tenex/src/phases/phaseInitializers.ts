import type { Conversation } from "@/conversations/types";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
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
  conversation: Conversation,
  availableAgents: Agent[]
): Promise<PhaseInitializationResult> {
  const initializer = phaseInitializers[phase];
  if (!initializer) {
    throw new Error(`No initializer found for phase: ${phase}`);
  }
  return initializer.initialize(conversation, availableAgents);
}
