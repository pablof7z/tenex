import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { OrchestrationCoordinator } from "@/core/orchestration/integration/OrchestrationCoordinator";
import { getNDK } from "@/nostr/ndkClient";
import type { Agent } from "@/utils/agents/Agent";
import type { AgentConfigurationManager } from "@/utils/agents/AgentConfigurationManager";
import { AgentSelectionService } from "@/utils/agents/AgentSelectionService";
import { ChatEventProcessor } from "@/utils/agents/ChatEventProcessor";
import { ConversationManager } from "@/utils/agents/ConversationManager";
import type { ConversationStorage } from "@/utils/agents/ConversationStorage";
import { EventRouter } from "@/utils/agents/EventRouter";
import { OrchestrationExecutionService } from "@/utils/agents/OrchestrationExecutionService";
import { ResponseCoordinator } from "@/utils/agents/ResponseCoordinator";
import { TaskEventProcessor } from "@/utils/agents/TaskEventProcessor";
import { SystemPromptContextFactory } from "@/utils/agents/prompts/SystemPromptContextFactory";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";

/**
 * Handles chat and task events for agents with orchestration support
 * Now decomposed into specialized components for better maintainability
 */
export class AgentCommunicationHandler {
    // Core components
    private eventRouter: EventRouter;
    private conversationManager: ConversationManager;
    private responseCoordinator: ResponseCoordinator;
    private chatEventProcessor: ChatEventProcessor;
    private taskEventProcessor: TaskEventProcessor;

    // Supporting services
    private configManager: AgentConfigurationManager;
    private conversationStorage: ConversationStorage;
    private projectInfo?: ProjectRuntimeInfo;
    private agents: Map<string, Agent>;
    private orchestrationCoordinator?: OrchestrationCoordinator;
    private contextFactory: SystemPromptContextFactory;
    private agentSelectionService: AgentSelectionService;
    private orchestrationExecutionService?: OrchestrationExecutionService;

    // Function dependencies
    private getAgentFn: (name?: string) => Promise<Agent>;
    private getAgentByPubkeyFn: (pubkey: string) => Promise<Agent | undefined>;
    private isEventFromAnyAgentFn: (eventPubkey: string) => Promise<boolean>;
    private formatAvailableAgentsForPromptFn: (excludeAgent?: string) => Promise<string>;
    private generateEnvironmentContextFn: (agentName: string) => string;
    private getAllAvailableAgentsFn?: () => Promise<
        Map<string, { description: string; role: string; capabilities: string }>
    >;

    constructor(
        configManager: AgentConfigurationManager,
        conversationStorage: ConversationStorage,
        agents: Map<string, Agent>,
        projectInfo?: ProjectRuntimeInfo,
        orchestrationCoordinator?: OrchestrationCoordinator
    ) {
        this.configManager = configManager;
        this.conversationStorage = conversationStorage;
        this.agents = agents;
        this.projectInfo = projectInfo;
        this.orchestrationCoordinator = orchestrationCoordinator;

        // Initialize supporting services
        this.contextFactory = new SystemPromptContextFactory(projectInfo);
        this.agentSelectionService = new AgentSelectionService(
            agents,
            projectInfo,
            orchestrationCoordinator,
            this.contextFactory,
            conversationStorage
        );

        // Initialize orchestration execution service if coordinator is available
        if (orchestrationCoordinator) {
            this.orchestrationExecutionService = new OrchestrationExecutionService(
                orchestrationCoordinator,
                undefined, // responsePublisher - not available in this context
                configManager
            );
        }

        // Initialize core components
        this.eventRouter = new EventRouter(conversationStorage);
        this.conversationManager = new ConversationManager(agents, this.contextFactory);
        this.responseCoordinator = new ResponseCoordinator(
            configManager,
            this.contextFactory,
            projectInfo,
            this.orchestrationExecutionService
        );

        // Initialize event processors
        this.chatEventProcessor = new ChatEventProcessor(
            this.eventRouter,
            this.conversationManager,
            this.agentSelectionService,
            this.responseCoordinator,
            this.orchestrationExecutionService
        );

        this.taskEventProcessor = new TaskEventProcessor(
            this.eventRouter,
            this.conversationManager,
            this.agentSelectionService,
            this.responseCoordinator,
            this.orchestrationExecutionService
        );
    }

    /**
     * Set function dependencies (injected to avoid circular dependencies)
     */
    setDependencies(dependencies: {
        getAgent: (name?: string) => Promise<Agent>;
        getAgentByPubkey: (pubkey: string) => Promise<Agent | undefined>;
        isEventFromAnyAgent: (eventPubkey: string) => Promise<boolean>;
        formatAvailableAgentsForPrompt: (excludeAgent?: string) => Promise<string>;
        generateEnvironmentContext: (agentName: string) => string;
        getAllAvailableAgents?: () => Promise<
            Map<string, { description: string; role: string; capabilities: string }>
        >;
    }): void {
        this.getAgentFn = dependencies.getAgent;
        this.getAgentByPubkeyFn = dependencies.getAgentByPubkey;
        this.isEventFromAnyAgentFn = dependencies.isEventFromAnyAgent;
        this.formatAvailableAgentsForPromptFn = dependencies.formatAvailableAgentsForPrompt;
        this.generateEnvironmentContextFn = dependencies.generateEnvironmentContext;
        this.getAllAvailableAgentsFn = dependencies.getAllAvailableAgents;

        // Update context factory with dependencies
        this.contextFactory.updateDependencies({
            getAllAvailableAgents: dependencies.getAllAvailableAgents,
            formatAvailableAgentsForPrompt: dependencies.formatAvailableAgentsForPrompt,
        });

        // Update agent selection service with dependencies
        this.agentSelectionService.updateDependencies({
            isEventFromAnyAgent: dependencies.isEventFromAnyAgent,
            getAgentByPubkey: dependencies.getAgentByPubkey,
            getAllAvailableAgents: dependencies.getAllAvailableAgents,
        });

        // Update response coordinator with dependencies
        this.responseCoordinator.setIsEventFromAnyAgentFn(dependencies.isEventFromAnyAgent);
    }

    /**
     * Update the agents Map after initialization
     */
    updateAgentsMap(agents: Map<string, Agent>): void {
        this.agents = agents;
        this.conversationManager.updateAgentsMap(agents);
        this.agentSelectionService.updateAgents(agents);
    }

    /**
     * Handle chat events with multi-agent orchestration
     * Now delegates to ChatEventProcessor for better separation of concerns
     */
    async handleChatEvent(
        event: NDKEvent,
        agentName = "code",
        llmName?: string,
        mentionedPubkeys: string[] = []
    ): Promise<void> {
        return this.chatEventProcessor.processEvent(event, agentName, llmName, mentionedPubkeys);
    }

    /**
     * Handle task events with multi-agent orchestration
     * Now delegates to TaskEventProcessor for better separation of concerns
     */
    async handleTaskEvent(
        event: NDKEvent,
        agentName = "code",
        llmName?: string,
        mentionedPubkeys: string[] = []
    ): Promise<void> {
        return this.taskEventProcessor.processEvent(event, agentName, llmName, mentionedPubkeys);
    }

    /**
     * Update project info and propagate to components
     */
    updateProjectInfo(projectInfo: ProjectRuntimeInfo): void {
        this.projectInfo = projectInfo;
        // Update components that depend on project info
        // Note: ResponseCoordinator gets project info in constructor, could add update method if needed
    }

    /**
     * Extract conversation ID from an event (legacy compatibility)
     * @deprecated Use EventRouter.extractConversationId() directly
     */
    extractConversationId(event: NDKEvent): string {
        return this.eventRouter.extractConversationId(event);
    }
}
