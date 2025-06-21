import { randomBytes } from "node:crypto";

/**
 * Structured event IDs for distributed tracing across the TENEX system.
 * These IDs allow tracing a single request through all components.
 */
export interface TracingContext {
  // Core trace IDs
  conversationId: string; // ID of the conversation (from Nostr event)
  executionId: string; // Unique ID for this specific execution/request
  agentExecutionId?: string; // ID for a specific agent's execution within the conversation
  
  // Parent-child relationships for distributed tracing
  parentExecutionId?: string; // For nested operations
  rootExecutionId?: string; // The original execution that started the chain
  
  // Timing and metadata
  startTime: number; // Unix timestamp when this execution started
  phaseContext?: {
    phase: string;
    phaseExecutionId: string; // Unique ID for this phase execution
  };
  
  // Tool execution context
  toolExecutionId?: string; // ID for tracking tool executions
  
  // Routing context
  routingDecisionId?: string; // ID for routing decisions
}

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(prefix: string = "exec"): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Create a new tracing context for a conversation
 */
export function createTracingContext(conversationId: string): TracingContext {
  const executionId = generateExecutionId();
  return {
    conversationId,
    executionId,
    rootExecutionId: executionId,
    startTime: Date.now(),
  };
}

/**
 * Create a child tracing context for nested operations
 */
export function createChildContext(parent: TracingContext, type: string = "child"): TracingContext {
  return {
    ...parent,
    executionId: generateExecutionId(type),
    parentExecutionId: parent.executionId,
    rootExecutionId: parent.rootExecutionId || parent.executionId,
  };
}

/**
 * Create an agent execution context
 */
export function createAgentExecutionContext(
  parent: TracingContext,
  agentName: string
): TracingContext {
  const agentExecutionId = generateExecutionId(`agent_${agentName}`);
  return {
    ...parent,
    executionId: generateExecutionId("exec"),
    agentExecutionId,
    parentExecutionId: parent.executionId,
  };
}

/**
 * Create a tool execution context
 */
export function createToolExecutionContext(
  parent: TracingContext,
  toolName: string
): TracingContext {
  const toolExecutionId = generateExecutionId(`tool_${toolName}`);
  return {
    ...parent,
    executionId: generateExecutionId("exec"),
    toolExecutionId,
    parentExecutionId: parent.executionId,
  };
}

/**
 * Create a phase execution context
 */
export function createPhaseExecutionContext(
  parent: TracingContext,
  phase: string
): TracingContext {
  const phaseExecutionId = generateExecutionId(`phase_${phase}`);
  return {
    ...parent,
    executionId: generateExecutionId("exec"),
    phaseContext: {
      phase,
      phaseExecutionId,
    },
    parentExecutionId: parent.executionId,
  };
}

/**
 * Create a routing decision context
 */
export function createRoutingContext(parent: TracingContext): TracingContext {
  const routingDecisionId = generateExecutionId("routing");
  return {
    ...parent,
    executionId: generateExecutionId("exec"),
    routingDecisionId,
    parentExecutionId: parent.executionId,
  };
}

/**
 * Format tracing context for logging
 */
export function formatTracingContext(context: TracingContext): Record<string, unknown> {
  return {
    conversationId: context.conversationId,
    executionId: context.executionId,
    ...(context.parentExecutionId && { parentExecutionId: context.parentExecutionId }),
    ...(context.rootExecutionId && { rootExecutionId: context.rootExecutionId }),
    ...(context.agentExecutionId && { agentExecutionId: context.agentExecutionId }),
    ...(context.toolExecutionId && { toolExecutionId: context.toolExecutionId }),
    ...(context.routingDecisionId && { routingDecisionId: context.routingDecisionId }),
    ...(context.phaseContext && {
      phase: context.phaseContext.phase,
      phaseExecutionId: context.phaseContext.phaseExecutionId,
    }),
    duration: Date.now() - context.startTime,
  };
}