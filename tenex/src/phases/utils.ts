import { logger } from "@/utils/logger";

export interface PhaseInitializationResult {
  success: boolean;
  message?: string;
}

export function handlePhaseError(phaseName: string, error: unknown): PhaseInitializationResult {
  logger.error(`[${phaseName} Phase] Failed to initialize ${phaseName.toLowerCase()} phase`, {
    error,
  });
  return {
    success: false,
    message: `${phaseName} phase initialization failed: ${error}`,
  };
}
