import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
import { NDKAgent } from "@/events/NDKAgent";
import type { AgentConfig, AgentProfile } from "@/agents/types";

/**
 * Service for publishing agent-related Nostr events
 */
export class AgentPublisher {
  constructor(private ndk: NDK) {}

  /**
   * Publishes a kind:0 profile event for an agent
   */
  async publishAgentProfile(
    signer: NDKPrivateKeySigner,
    agentName: string,
    agentRole: string,
    projectName: string,
    projectPubkey: string
  ): Promise<void> {
    try {
      // Generate random dicebear avatar
      const avatarStyle = "bottts"; // Using bottts style for agents
      const seed = signer.pubkey; // Use pubkey as seed for consistent avatar
      const avatarUrl = `https://api.dicebear.com/7.x/${avatarStyle}/svg?seed=${seed}`;

      const profile: AgentProfile & { picture?: string; project?: string } = {
        name: agentName,
        role: agentRole,
        description: `${agentRole} agent for ${projectName}`,
        capabilities: [agentRole.toLowerCase()],
        picture: avatarUrl,
        project: projectName,
      };

      const profileEvent = new NDKEvent(this.ndk, {
        kind: 0,
        pubkey: signer.pubkey,
        content: JSON.stringify(profile),
        tags: [
          ["p", projectPubkey, "", "project"],
        ],
      });

      await profileEvent.sign(signer);
      await profileEvent.publish();

      logger.info("Published agent profile", {
        agentName,
        pubkey: signer.pubkey,
        avatar: avatarUrl,
      });
    } catch (error) {
      logger.error("Failed to publish agent profile", {
        error,
        agentName,
      });
      throw error;
    }
  }

  /**
   * Publishes an agent request event
   */
  async publishAgentRequest(
    signer: NDKPrivateKeySigner,
    agentConfig: AgentConfig,
    projectPubkey: string,
    ndkAgentEventId?: string
  ): Promise<NDKEvent> {
    try {
      const tags: string[][] = [
        ["p", projectPubkey, "", "project"],
      ];

      // Only add e-tag if this agent was created from an NDKAgent event
      if (ndkAgentEventId) {
        tags.push(["e", ndkAgentEventId, "", "agent-definition"]);
      }

      // Add agent metadata tags
      tags.push(
        ["name", agentConfig.name],
        ["role", agentConfig.role],
        ["expertise", agentConfig.expertise || agentConfig.role]
      );

      const requestEvent = new NDKEvent(this.ndk, {
        kind: 4200, // Agent request event kind
        pubkey: signer.pubkey,
        content: JSON.stringify({
          name: agentConfig.name,
          role: agentConfig.role,
          expertise: agentConfig.expertise,
          instructions: agentConfig.instructions,
          tools: agentConfig.tools || [],
          llmConfig: agentConfig.llmConfig,
        }),
        tags,
      });

      await requestEvent.sign(signer);
      await requestEvent.publish();

      logger.info("Published agent request", {
        agentName: agentConfig.name,
        pubkey: signer.pubkey,
        hasNDKAgentEvent: !!ndkAgentEventId,
      });

      return requestEvent;
    } catch (error) {
      logger.error("Failed to publish agent request", {
        error,
        agentName: agentConfig.name,
      });
      throw error;
    }
  }

  /**
   * Publishes all agent-related events when creating a new agent
   */
  async publishAgentCreation(
    signer: NDKPrivateKeySigner,
    agentConfig: AgentConfig,
    projectName: string,
    projectPubkey: string,
    ndkAgentEventId?: string
  ): Promise<void> {
    // Publish profile event
    await this.publishAgentProfile(
      signer,
      agentConfig.name,
      agentConfig.role,
      projectName,
      projectPubkey
    );

    // Publish request event
    await this.publishAgentRequest(
      signer,
      agentConfig,
      projectPubkey,
      ndkAgentEventId
    );
  }
}