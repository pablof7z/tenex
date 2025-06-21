import type { ConversationState } from "@/conversations/types";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { ChatPhaseInitializer } from "./ChatPhaseInitializer";
import { ChoresPhaseInitializer } from "./ChoresPhaseInitializer";
import { ExecutePhaseInitializer } from "./ExecutePhaseInitializer";
import { PlanPhaseInitializer } from "./PlanPhaseInitializer";
import { ReviewPhaseInitializer } from "./ReviewPhaseInitializer";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";

const initializers: Map<Phase, PhaseInitializer> = new Map([
  ["chat", new ChatPhaseInitializer()],
  ["plan", new PlanPhaseInitializer()],
  ["execute", new ExecutePhaseInitializer()],
  ["review", new ReviewPhaseInitializer()],
  ["chores", new ChoresPhaseInitializer()],
]);

export function getInitializer(phase: Phase): PhaseInitializer {
  const initializer = initializers.get(phase);
  if (!initializer) {
    throw new Error(`No initializer found for phase: ${phase}`);
  }
  return initializer;
}

export async function initializePhase(
  phase: Phase,
  conversation: ConversationState,
  availableAgents: Agent[]
): Promise<PhaseInitializationResult> {
  const initializer = getInitializer(phase);
  return initializer.initialize(conversation, availableAgents);
}
