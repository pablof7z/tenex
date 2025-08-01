import { type LogModule, logger as baseLogger } from "@/utils/logger";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger } from "@/tracing";
import chalk from "chalk";
import type { Phase } from "@/conversations/phases";
import type { Agent } from "@/agents/types";

/**
 * Event types for structured logging
 */
export type EventType =
    | "agent_thinking"
    | "agent_decision"
    | "agent_handoff"
    | "phase_transition_trigger"
    | "phase_transition_decision"
    | "phase_transition_executed"
    | "routing_analysis"
    | "routing_decision"
    | "tool_execution_start"
    | "tool_execution_complete"
    | "conversation_start"
    | "conversation_complete"
    | "execution_flow_start"
    | "execution_flow_complete";

export interface AgentThinkingEvent {
    type: "agent_thinking";
    agent: string;
    reasoning: string;
    context: {
        userMessage?: string;
        considerations?: string[];
        leaningToward?: string;
        confidence?: number;
    };
}

export interface AgentDecisionEvent {
    type: "agent_decision";
    agent: string;
    decisionType: "routing" | "tool_use" | "phase_transition" | "completion";
    decision: string;
    reasoning: string;
    confidence?: number;
    alternatives?: string[];
}

export interface AgentHandoffEvent {
    type: "agent_handoff";
    from: string;
    to: string;
    task: string;
    context?: string;
    phase: Phase;
}

export interface PhaseTransitionTriggerEvent {
    type: "phase_transition_trigger";
    conversationId: string;
    currentPhase: Phase;
    trigger: string;
    triggerAgent: string;
    signal: string;
}

export interface PhaseTransitionDecisionEvent {
    type: "phase_transition_decision";
    conversationId: string;
    from: Phase;
    to: Phase;
    decisionBy: string;
    reason: string;
    confidence?: number;
}

export interface PhaseTransitionExecutedEvent {
    type: "phase_transition_executed";
    conversationId: string;
    from: Phase;
    to: Phase;
    handoffTo?: string;
    handoffMessage?: string;
    duration?: number;
}

export interface RoutingAnalysisEvent {
    type: "routing_analysis";
    agent: string;
    messageAnalysis: string;
    candidateAgents: string[];
    phaseConsiderations?: string;
}

export interface RoutingDecisionEvent {
    type: "routing_decision";
    agent: string;
    targetAgents: string[];
    targetPhase?: Phase;
    reason: string;
    confidence?: number;
}

export interface ToolExecutionStartEvent {
    type: "tool_execution_start";
    agent: string;
    tool: string;
    parameters?: Record<string, unknown>;
}

export interface ToolExecutionCompleteEvent {
    type: "tool_execution_complete";
    agent: string;
    tool: string;
    status: "success" | "error";
    duration: number;
    result?: string;
    error?: string;
}

export interface ConversationStartEvent {
    type: "conversation_start";
    conversationId: string;
    title?: string;
    userMessage: string;
    eventId?: string;
}

export interface ConversationCompleteEvent {
    type: "conversation_complete";
    conversationId: string;
    finalPhase: Phase;
    totalDuration: number;
    success: boolean;
}

export interface ExecutionFlowStartEvent {
    type: "execution_flow_start";
    conversationId: string;
    narrative: string;
}

export interface ExecutionFlowCompleteEvent {
    type: "execution_flow_complete";
    conversationId: string;
    narrative: string;
    success: boolean;
}

export type LogEvent =
    | AgentThinkingEvent
    | AgentDecisionEvent
    | AgentHandoffEvent
    | PhaseTransitionTriggerEvent
    | PhaseTransitionDecisionEvent
    | PhaseTransitionExecutedEvent
    | RoutingAnalysisEvent
    | RoutingDecisionEvent
    | ToolExecutionStartEvent
    | ToolExecutionCompleteEvent
    | ConversationStartEvent
    | ConversationCompleteEvent
    | ExecutionFlowStartEvent
    | ExecutionFlowCompleteEvent;

/**
 * Unified execution logger for structured event logging
 */
export class ExecutionLogger {
    private tracingLogger: TracingLogger;
    private startTimes: Map<string, number> = new Map();

    constructor(
        private context: TracingContext,
        private module: LogModule = "agent"
    ) {
        this.tracingLogger = createTracingLogger(context, module);
    }

    /**
     * Update context (e.g., when agent changes)
     */
    updateContext(context: TracingContext): void {
        this.context = context;
        this.tracingLogger = createTracingLogger(context, this.module);
    }

    /**
     * Log an event with structured formatting
     */
    logEvent(event: LogEvent): void {
        switch (event.type) {
            case "agent_thinking":
                this.logAgentThinking(event);
                break;
            case "agent_decision":
                this.logAgentDecision(event);
                break;
            case "agent_handoff":
                this.logAgentHandoff(event);
                break;
            case "phase_transition_trigger":
                this.logPhaseTransitionTrigger(event);
                break;
            case "phase_transition_decision":
                this.logPhaseTransitionDecision(event);
                break;
            case "phase_transition_executed":
                this.logPhaseTransitionExecuted(event);
                break;
            case "routing_analysis":
                this.logRoutingAnalysis(event);
                break;
            case "routing_decision":
                this.logRoutingDecision(event);
                break;
            case "tool_execution_start":
                this.logToolExecutionStart(event);
                break;
            case "tool_execution_complete":
                this.logToolExecutionComplete(event);
                break;
            case "conversation_start":
                this.logConversationStart(event);
                break;
            case "conversation_complete":
                this.logConversationComplete(event);
                break;
            case "execution_flow_complete":
                this.logExecutionFlowComplete(event);
                break;
        }
    }

    // Agent Events
    private logAgentThinking(event: AgentThinkingEvent): void {
        console.log();
        console.log(chalk.blue(`🤔 AGENT THINKING [${chalk.bold(event.agent)}]`));
        
        if (event.context.userMessage) {
            console.log(chalk.gray(`    ├─ User: "${this.truncate(event.context.userMessage, 60)}"`));
        }
        
        console.log(chalk.white(`    ├─ Reasoning: ${event.reasoning}`));
        
        if (event.context.considerations?.length) {
            console.log(chalk.gray(`    ├─ Considering: ${event.context.considerations.join(", ")}`));
        }
        
        if (event.context.leaningToward) {
            console.log(chalk.yellow(`    ├─ Leaning toward: ${event.context.leaningToward}`));
        }
        
        if (event.context.confidence !== undefined) {
            const confColor = event.context.confidence > 0.8 ? chalk.green : 
                            event.context.confidence > 0.5 ? chalk.yellow : chalk.red;
            console.log(confColor(`    └─ Confidence: ${(event.context.confidence * 100).toFixed(0)}%`));
        }

        this.tracingLogger.info("Agent thinking", {
            event: "agent_thinking",
            ...event
        });
    }

    private logAgentDecision(event: AgentDecisionEvent): void {
        console.log();
        console.log(chalk.green(`✅ AGENT DECISION [${chalk.bold(event.agent)}]`));
        console.log(chalk.white(`    ├─ Type: ${event.decisionType}`));
        console.log(chalk.white(`    ├─ Decision: ${chalk.bold(event.decision)}`));
        console.log(chalk.gray(`    ├─ Reasoning: ${event.reasoning}`));
        
        if (event.alternatives?.length) {
            console.log(chalk.dim(`    ├─ Alternatives: ${event.alternatives.join(", ")}`));
        }
        
        if (event.confidence !== undefined) {
            const confColor = event.confidence > 0.8 ? chalk.green : 
                            event.confidence > 0.5 ? chalk.yellow : chalk.red;
            console.log(confColor(`    └─ Confidence: ${(event.confidence * 100).toFixed(0)}%`));
        }

        this.tracingLogger.info("Agent decision made", {
            event: "agent_decision",
            ...event
        });
    }

    private logAgentHandoff(event: AgentHandoffEvent): void {
        console.log();
        console.log(chalk.magenta(`🤝 AGENT HANDOFF`));
        console.log(chalk.white(`    ├─ From: ${chalk.bold(event.from)} → ${chalk.bold(event.to)}`));
        console.log(chalk.white(`    ├─ Task: "${this.truncate(event.task, 80)}"`));
        if (event.context) {
            console.log(chalk.gray(`    ├─ Context: ${event.context}`));
        }
        console.log(chalk.dim(`    └─ Phase: ${event.phase}`));

        this.tracingLogger.info("Agent handoff", {
            event: "agent_handoff",
            ...event
        });
    }

    // Phase Transition Events
    private logPhaseTransitionTrigger(event: PhaseTransitionTriggerEvent): void {
        console.log();
        console.log(chalk.yellow(`⚡ PHASE TRANSITION TRIGGER [${this.shortId(event.conversationId)}]`));
        console.log(chalk.white(`    ├─ Current phase: ${chalk.bold(event.currentPhase)}`));
        console.log(chalk.white(`    ├─ Trigger: ${event.trigger}`));
        console.log(chalk.white(`    ├─ Triggered by: ${chalk.bold(event.triggerAgent)}`));
        console.log(chalk.yellow(`    └─ Signal: ${event.signal}`));

        this.tracingLogger.info("Phase transition triggered", {
            event: "phase_transition_trigger",
            ...event
        });
    }

    private logPhaseTransitionDecision(event: PhaseTransitionDecisionEvent): void {
        console.log();
        console.log(chalk.cyan(`🔄 PHASE TRANSITION DECISION [${this.shortId(event.conversationId)}]`));
        console.log(chalk.white(`    ├─ ${chalk.red(event.from)} → ${chalk.green(event.to)}`));
        console.log(chalk.white(`    ├─ Decided by: ${chalk.bold(event.decisionBy)}`));
        console.log(chalk.gray(`    ├─ Reason: ${event.reason}`));
        
        if (event.confidence !== undefined) {
            const confColor = event.confidence > 0.8 ? chalk.green : 
                            event.confidence > 0.5 ? chalk.yellow : chalk.red;
            console.log(confColor(`    └─ Confidence: ${(event.confidence * 100).toFixed(0)}%`));
        }

        this.tracingLogger.info("Phase transition decision", {
            event: "phase_transition_decision",
            ...event
        });
    }

    private logPhaseTransitionExecuted(event: PhaseTransitionExecutedEvent): void {
        console.log();
        console.log(chalk.greenBright(`✅ PHASE TRANSITION EXECUTED [${this.shortId(event.conversationId)}]`));
        console.log(chalk.white(`    ├─ ${chalk.bold.red(event.from)} → ${chalk.bold.green(event.to)}`));
        
        if (event.handoffTo) {
            console.log(chalk.white(`    ├─ Handed off to: ${chalk.bold(event.handoffTo)}`));
        }
        
        if (event.handoffMessage) {
            console.log(chalk.gray(`    ├─ Message: "${this.truncate(event.handoffMessage, 80)}"`));
        }
        
        if (event.duration) {
            console.log(chalk.dim(`    └─ Duration: ${(event.duration / 1000).toFixed(1)}s`));
        }

        this.tracingLogger.success("Phase transition completed", {
            event: "phase_transition_executed",
            ...event
        });
    }

    // Routing Events
    private logRoutingAnalysis(event: RoutingAnalysisEvent): void {
        console.log();
        console.log(chalk.blue(`🔍 ROUTING ANALYSIS [${chalk.bold(event.agent)}]`));
        console.log(chalk.white(`    ├─ Analysis: ${event.messageAnalysis}`));
        console.log(chalk.white(`    ├─ Candidates: ${event.candidateAgents.join(", ")}`));
        
        if (event.phaseConsiderations) {
            console.log(chalk.gray(`    └─ Phase considerations: ${event.phaseConsiderations}`));
        }

        this.tracingLogger.info("Routing analysis", {
            event: "routing_analysis",
            ...event
        });
    }

    private logRoutingDecision(event: RoutingDecisionEvent): void {
        console.log();
        console.log(chalk.green(`📍 ROUTING DECISION [${chalk.bold(event.agent)}]`));
        console.log(chalk.white(`    ├─ Target agents: ${chalk.bold(event.targetAgents.join(", "))}`));
        
        if (event.targetPhase) {
            console.log(chalk.white(`    ├─ Target phase: ${chalk.bold(event.targetPhase)}`));
        }
        
        console.log(chalk.gray(`    ├─ Reason: ${event.reason}`));
        
        if (event.confidence !== undefined) {
            const confColor = event.confidence > 0.8 ? chalk.green : 
                            event.confidence > 0.5 ? chalk.yellow : chalk.red;
            console.log(confColor(`    └─ Confidence: ${(event.confidence * 100).toFixed(0)}%`));
        }
    }

    // Tool Execution Events
    private logToolExecutionStart(event: ToolExecutionStartEvent): void {
        const key = `${event.agent}-${event.tool}`;
        this.startTimes.set(key, Date.now());

        console.log();
        console.log(chalk.yellow(`🔧 TOOL EXECUTION START [${chalk.bold(event.agent)}]`));
        console.log(chalk.white(`    ├─ Tool: ${chalk.bold(event.tool)}`));
        
        if (event.parameters && Object.keys(event.parameters).length > 0) {
            console.log(chalk.gray(`    └─ Parameters: ${this.formatParams(event.parameters)}`));
        }

        this.tracingLogger.info("Tool execution started", {
            event: "tool_execution_start",
            ...event
        });
    }

    private logToolExecutionComplete(event: ToolExecutionCompleteEvent): void {
        const statusColor = event.status === "success" ? chalk.green : chalk.red;
        const statusIcon = event.status === "success" ? "✅" : "❌";

        console.log();
        console.log(statusColor(`${statusIcon} TOOL EXECUTION COMPLETE [${chalk.bold(event.agent)}]`));
        console.log(chalk.white(`    ├─ Tool: ${chalk.bold(event.tool)} → ${statusColor(event.status.toUpperCase())}`));
        console.log(chalk.dim(`    ├─ Duration: ${(event.duration / 1000).toFixed(2)}s`));
        
        if (event.result) {
            console.log(chalk.gray(`    ├─ Result: ${this.truncate(event.result, 80)}`));
        }
        
        if (event.error) {
            console.log(chalk.red(`    └─ Error: ${event.error}`));
        }

        this.tracingLogger.info("Tool execution completed", {
            event: "tool_execution_complete",
            ...event
        });
    }

    // Conversation Events
    private logConversationStart(event: ConversationStartEvent): void {
        console.log();
        console.log(chalk.bold.cyan(`🗣️  NEW CONVERSATION [${this.shortId(event.conversationId)}]${event.title ? ` "${event.title}"` : ""}`));
        console.log(chalk.white(`    User: ${chalk.italic(this.truncate(event.userMessage, 80))}`));
        
        if (event.eventId) {
            console.log(chalk.dim(`    Event: ${this.shortId(event.eventId)}`));
        }
        console.log();
    }

    private logConversationComplete(event: ConversationCompleteEvent): void {
        const statusColor = event.success ? chalk.green : chalk.red;
        const statusIcon = event.success ? "✅" : "❌";

        console.log();
        console.log(statusColor(`${statusIcon} CONVERSATION COMPLETE [${this.shortId(event.conversationId)}]`));
        console.log(chalk.white(`    ├─ Final phase: ${chalk.bold(event.finalPhase)}`));
        console.log(chalk.white(`    ├─ Duration: ${this.formatDuration(event.totalDuration)}`));
        console.log(statusColor(`    └─ Success: ${event.success}`));
        console.log();

        this.tracingLogger.info("Conversation completed", {
            event: "conversation_complete",
            ...event
        });
    }

    private logExecutionFlowComplete(event: ExecutionFlowCompleteEvent): void {
        const statusColor = event.success ? chalk.bgGreen : chalk.bgRed;
        const statusIcon = event.success ? "✅" : "❌";

        console.log();
        console.log(statusColor.white(` ${statusIcon} EXECUTION FLOW COMPLETE `));
        console.log(chalk.white(`[${this.shortId(event.conversationId)}] ${event.narrative}`));
        console.log();

        this.tracingLogger.info("Execution flow completed", {
            event: "execution_flow_complete",
            ...event
        });
    }

    // Helper methods
    private truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    }

    private shortId(id: string): string {
        return id.substring(0, 8);
    }

    private formatParams(params: Record<string, unknown>): string {
        const entries = Object.entries(params).slice(0, 3);
        const formatted = entries.map(([k, v]) => `${k}=${this.formatValue(v)}`).join(", ");
        return entries.length < Object.keys(params).length ? `${formatted}, ...` : formatted;
    }

    private formatValue(value: unknown): string {
        if (typeof value === "string") return `"${this.truncate(value, 30)}"`;
        if (typeof value === "object" && value !== null) return "{...}";
        return String(value);
    }

    private formatDuration(ms: number): string {
        const seconds = ms / 1000;
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    }

    // Quick logging methods
    agentThinking(agent: string, reasoning: string, context?: AgentThinkingEvent["context"]): void {
        this.logEvent({
            type: "agent_thinking",
            agent,
            reasoning,
            context: context || {}
        });
    }

    agentDecision(
        agent: string, 
        decisionType: AgentDecisionEvent["decisionType"], 
        decision: string,
        reasoning: string,
        options?: { confidence?: number; alternatives?: string[] }
    ): void {
        this.logEvent({
            type: "agent_decision",
            agent,
            decisionType,
            decision,
            reasoning,
            ...options
        });
    }

    routingDecision(
        agent: string,
        targetAgents: string[],
        reason: string,
        options?: { targetPhase?: Phase; confidence?: number }
    ): void {
        this.logEvent({
            type: "routing_decision",
            agent,
            targetAgents,
            reason,
            ...options
        });
    }

    toolStart(agent: string, tool: string, parameters?: Record<string, unknown>): void {
        this.logEvent({
            type: "tool_execution_start",
            agent,
            tool,
            parameters
        });
    }

    toolComplete(
        agent: string, 
        tool: string, 
        status: "success" | "error", 
        duration: number,
        options?: { result?: string; error?: string }
    ): void {
        this.logEvent({
            type: "tool_execution_complete",
            agent,
            tool,
            status,
            duration,
            ...options
        });
    }
}

/**
 * Create an execution logger instance
 */
export function createExecutionLogger(context: TracingContext, module?: LogModule): ExecutionLogger {
    return new ExecutionLogger(context, module);
}