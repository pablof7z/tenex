/**
 * Agent-related types for the orchestration system
 */

export interface AgentConfiguration {
  name: string;
  nsec: string;
  eventId?: string;
  role?: string;
}

export interface ProjectAgentsConfig {
  agents: Record<string, AgentConfiguration>;
}
