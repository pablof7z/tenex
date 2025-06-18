import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { SystemPromptComposer } from "../../prompts";
import type {
    AgentConfig,
    ConversationSignal,
    ConversationStore,
    EventContext,
    LLMProvider,
    NostrPublisher,
} from "../core/types";
import { Agent } from "./Agent";
import type { Team } from "./Team";
import { TurnManager } from "./TurnManager";

export class TeamLead extends Agent {
    private team: Team;
    private currentStageIndex = 0;
    private agents = new Map<string, Agent>();
    private activeSpeakers = new Set<string>();
    private turnManager: TurnManager;

    constructor(
        config: AgentConfig,
        llm: LLMProvider,
        store: ConversationStore,
        publisher: NostrPublisher,
        ndk: NDK,
        team: Team,
        toolRegistry?: ToolRegistry
    ) {
        super(config, llm, store, publisher, ndk, toolRegistry);
        this.team = team;
        
        // Set team size for proper prompt generation
        this.teamSize = team.members.length;

        // Team lead is always active
        this.setActiveSpeaker(true);

        // Initialize turn manager with first stage
        const firstStage = team.plan.stages[0];
        this.turnManager = new TurnManager({
            stageParticipants: firstStage?.participants || [],
            primarySpeaker: firstStage?.primarySpeaker,
        });

        // Initialize with first stage participants
        this.updateActiveSpeakers();
    }

    setTeamAgents(agents: Map<string, Agent>): void {
        this.agents = agents;
        
        // Set team size for all agents
        for (const agent of agents.values()) {
            agent.setTeamSize(this.teamSize);
        }
        
        // Update active speakers for current stage
        this.updateActiveSpeakers();
    }

    async handleEvent(event: NDKEvent, context: EventContext): Promise<void> {
        logger.info(
            `Team lead ${this.config.name} handling event for conversation ${context.conversationId}`
        );

        // CRITICAL: Never respond to our own events (applies to team lead too)
        if (event.pubkey === this.pubkey) {
            logger.warn(`Team lead ${this.config.name} received its own event - ignoring`);
            return;
        }

        // First, let active speakers respond
        await this.routeToActiveSpeakers(event, context);

        // Check if we should generate our own response
        if (this.shouldTeamLeadRespond()) {
            await super.handleEvent(event, context);
        }
    }

    private async routeToActiveSpeakers(event: NDKEvent, context: EventContext): Promise<void> {
        // Check if this is a user message or agent message
        const isUserMessage = !this.isAgentMessage(event);

        // Select appropriate speaker
        const selectedSpeaker = this.turnManager.selectSpeaker(event, isUserMessage);

        if (!selectedSpeaker) {
            logger.debug("No speaker selected for this event");
            return;
        }

        // Skip if speaker is team lead (will handle separately)
        if (selectedSpeaker === this.config.name) {
            return;
        }

        const agent = this.agents.get(selectedSpeaker);
        if (!agent) {
            logger.warn(`Selected speaker ${selectedSpeaker} not found in team agents`);
            return;
        }

        // Set current speaker
        this.turnManager.setCurrentSpeaker(selectedSpeaker);

        // Let selected agent respond
        await agent.handleEvent(event, context);

        // Record speech
        this.turnManager.recordSpeech(selectedSpeaker);

        // Check last message for signal
        const messages = await this.store.getMessages(context.conversationId);
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.agentName === selectedSpeaker && lastMessage.signal) {
            await this.checkForTransition(
                new Map([[selectedSpeaker, lastMessage.signal]]),
                context
            );
        }
    }

    private isAgentMessage(event: NDKEvent): boolean {
        // Check if the event author is one of our agents
        for (const agent of this.agents.values()) {
            if (event.pubkey === agent.getPubkey()) {
                return true;
            }
        }
        return false;
    }

    private async checkForTransition(
        responses: Map<string, ConversationSignal | undefined>,
        context: EventContext
    ): Promise<void> {
        // Count transition signals
        let readyForTransition = 0;
        let blocked = 0;

        for (const [agentName, signal] of responses) {
            if (signal?.type === "ready_for_transition") {
                readyForTransition++;
                logger.info(`Agent ${agentName} signaled ready for transition: ${signal.reason}`);
            } else if (signal?.type === "blocked") {
                blocked++;
                logger.warn(`Agent ${agentName} is blocked: ${signal.reason}`);
            }
        }

        // Transition if all active speakers are ready or if majority are ready
        const totalActive = this.activeSpeakers.size - 1; // Exclude team lead
        const shouldTransition =
            readyForTransition === totalActive ||
            (totalActive > 2 && readyForTransition > totalActive / 2);

        if (shouldTransition) {
            await this.transitionToNextStage(context);
        } else if (blocked > 0) {
            // Team lead should intervene if agents are blocked
            logger.info("Team lead should intervene - agents are blocked");
        }
    }

    private async transitionToNextStage(context: EventContext): Promise<void> {
        this.currentStageIndex++;

        if (this.team.isComplete(this.currentStageIndex)) {
            logger.info(`Conversation ${context.conversationId} complete - all stages finished`);
            await this.markConversationComplete(context);
            return;
        }

        const currentStage = this.team.plan.stages[this.currentStageIndex];
        if (currentStage) {
            logger.info(
                `Transitioning to stage ${this.currentStageIndex + 1}: ${currentStage.purpose}`
            );
        } else {
            logger.info("Transitioning to final stage");
        }

        // Update active speakers
        this.updateActiveSpeakers();

        // Notify new active speakers
        await this.notifyActiveSpeakers(context);
    }

    private updateActiveSpeakers(): void {
        this.activeSpeakers.clear();

        const stage = this.team.plan.stages[this.currentStageIndex];
        const participants = stage?.participants || [];

        for (const participant of participants) {
            this.activeSpeakers.add(participant);

            // Update agent's active speaker status
            const agent = this.agents.get(participant);
            if (agent) {
                agent.setActiveSpeaker(true);
            }
        }

        // Deactivate non-participants
        for (const [agentName, agent] of this.agents) {
            if (!this.activeSpeakers.has(agentName)) {
                agent.setActiveSpeaker(false);
            }
        }

        // Update turn manager with new stage participants
        this.turnManager.updateStageParticipants(participants, stage?.primarySpeaker);

        logger.info(`Updated active speakers: ${Array.from(this.activeSpeakers).join(", ")}`);
    }

    private shouldTeamLeadRespond(): boolean {
        // Team lead responds if:
        // 1. They are in the active speakers list
        // 2. It's a transition point
        // 3. Agents are blocked
        return this.activeSpeakers.has(this.config.name);
    }

    private async notifyActiveSpeakers(context: EventContext): Promise<void> {
        const stage = this.team.plan.stages[this.currentStageIndex];
        const notification = stage
            ? `Moving to next stage: ${stage.purpose}. Active speakers: ${Array.from(this.activeSpeakers).join(", ")}`
            : `Moving to final stage. Active speakers: ${Array.from(this.activeSpeakers).join(", ")}`;

        // Publish notification as team lead
        await this.publisher.publishResponse({ content: notification }, context, this.signer);
    }

    private async markConversationComplete(context: EventContext): Promise<void> {
        const completion = `Conversation complete. All ${this.team.plan.stages.length} stages have been executed successfully.`;

        await this.publisher.publishResponse(
            {
                content: completion,
                signal: { type: "complete", reason: "All stages completed" },
            },
            context,
            this.signer
        );
    }

    protected buildSystemPrompt(): string {
        const stageInfo =
            this.currentStageIndex < this.team.plan.stages.length
                ? this.team.plan.stages[this.currentStageIndex]
                : null;

        const currentStageInfo = stageInfo
            ? `Current stage: ${stageInfo.purpose}
Expected outcome: ${stageInfo.expectedOutcome}
Transition criteria: ${stageInfo.transitionCriteria}`
            : "Conversation is in final stage.";

        const teamInfo = `Current team: ${this.team.members.join(", ")}
Active speakers: ${Array.from(this.activeSpeakers).join(", ")}`;

        return SystemPromptComposer.composeTeamLeadPrompt({
            name: this.config.name,
            role: this.config.role,
            instructions: this.config.instructions,
            teamSize: this.teamSize,
            toolDescriptions: this.toolRegistry?.generateSystemPrompt(),
            teamInfo,
            stageInfo: currentStageInfo,
        });
    }
}
