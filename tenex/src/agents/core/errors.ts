export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export class TeamFormationError extends AgentError {
  constructor(message: string, details?: unknown) {
    super(message, "TEAM_FORMATION_ERROR", details);
  }
}

export class LLMError extends AgentError {
  constructor(message: string, details?: unknown) {
    super(message, "LLM_ERROR", details);
  }
}

export class ConversationError extends AgentError {
  constructor(message: string, details?: unknown) {
    super(message, "CONVERSATION_ERROR", details);
  }
}

export class ConfigurationError extends AgentError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIGURATION_ERROR", details);
  }
}

export class AgentNotFoundError extends AgentError {
  constructor(agentName: string) {
    super(`Agent '${agentName}' not found`, "AGENT_NOT_FOUND", { agentName });
  }
}

export class InvalidSignalError extends AgentError {
  constructor(signal: unknown) {
    super("Invalid conversation signal", "INVALID_SIGNAL", { signal });
  }
}
