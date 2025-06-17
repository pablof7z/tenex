// Main orchestration exports
export { createOrchestrationCoordinator } from "@/core/orchestration/OrchestrationFactory";
export type { OrchestrationDependencies } from "@/core/orchestration/OrchestrationFactory";
export type { TeamOrchestrator } from "@/core/orchestration/TeamOrchestrator";
export { TeamOrchestratorImpl } from "@/core/orchestration/TeamOrchestrator";
export type {
    OrchestrationStrategy,
    RequestAnalysis,
    TaskDefinition,
    TeamFormation,
    Team,
    AgentDefinition,
    ProjectContext,
    EventContext,
    LLMResponse,
    LLMProvider,
    LogContext,
    Logger,
    OrchestrationConfig,
} from "@/core/orchestration/types";
export { defaultOrchestrationConfig } from "@/core/orchestration/types";

// Strategy exports
export { SingleResponderStrategy } from "@/core/orchestration/strategies/SingleResponderStrategy";
export { HierarchicalStrategy } from "@/core/orchestration/strategies/HierarchicalStrategy";
export { ParallelExecutionStrategy } from "@/core/orchestration/strategies/ParallelExecutionStrategy";
export type {
    OrchestrationStrategy as IOrchestrationStrategy,
    StrategyExecutionResult,
    AgentResponse,
} from "@/core/orchestration/strategies/OrchestrationStrategy";

// Supervision exports
export { MilestoneTracker } from "@/core/orchestration/supervision/MilestoneTracker";
export { SupervisorDecisionMaker } from "@/core/orchestration/supervision/SupervisorDecisionMaker";
export { SupervisionSystem } from "@/core/orchestration/supervision/SupervisionSystem";
export type {
    MilestoneContext,
    Milestone,
    SupervisionDecision,
    SupervisionEvent,
} from "@/core/orchestration/supervision/types";
export type {
    SupervisionTask,
    SupervisionCheckpoint,
    SupervisionResult,
    SupervisionConfig,
} from "@/core/orchestration/supervision/SupervisionSystem";

// Reflection exports
export type { CorrectionDetector } from "@/core/orchestration/reflection/CorrectionDetector";
export type { LessonGenerator } from "@/core/orchestration/reflection/LessonGenerator";
export type { LessonPublisher } from "@/core/orchestration/reflection/LessonPublisher";
export type { ReflectionSystem } from "@/core/orchestration/reflection/ReflectionSystem";
export type {
    CorrectionAnalysis,
    CorrectionPattern,
    AgentLesson,
    ReflectionTrigger,
} from "@/core/orchestration/reflection/types";

// Green light exports
export type { ReviewCoordinatorImpl } from "@/core/orchestration/greenlight/ReviewCoordinator";
export type { ReviewAggregatorImpl } from "@/core/orchestration/greenlight/ReviewAggregator";
export type { ReviewSystem } from "@/core/orchestration/greenlight/ReviewSystem";
export { GreenLightSystem } from "@/core/orchestration/greenlight/GreenLightSystem";
export type {
    ReviewRequest,
    WorkSummary,
    ReviewDecision,
    ReviewResult,
} from "@/core/orchestration/greenlight/types";

// Integration exports
export { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
export type { OrchestrationResult } from "@/core/orchestration/integration/OrchestrationCoordinator";
export type { TeamEventHandler } from "@/core/orchestration/integration/TeamEventHandler";
export { TeamEventHandlerImpl } from "@/core/orchestration/integration/TeamEventHandler";

// Analysis exports
export type { TeamFormationAnalyzer } from "@/core/orchestration/TeamFormationAnalyzer";
export { TeamFormationAnalyzerImpl } from "@/core/orchestration/TeamFormationAnalyzerImpl";
export type { PromptBuilder } from "@/core/orchestration/PromptBuilder";
export { PromptBuilderImpl } from "@/core/orchestration/PromptBuilderImpl";

// Adapter exports (removed as part of cleanup)

// Error exports
export {
    OrchestrationError,
    TeamFormationError,
    NoSuitableAgentsError,
    SupervisionAbortError,
    ReviewTimeoutError,
    ReflectionError,
    ConfigurationError,
} from "@/core/orchestration/errors";
