import { getNDK } from "@/nostr/ndkClient";
import { toKebabCase } from "@/utils/agents";
import { formatError } from "@/utils/errors";
import { NDKEvent, NDKPrivateKeySigner, type NDKProject } from "@nostr-dev-kit/ndk";
import { logInfo } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import type { AgentsJson } from "@tenex/types/agents";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";

export interface CreateAgentOptions {
  projectPath: string;
  projectTitle: string;
  agentName: string;
  agentEventId?: string;
  projectEvent?: NDKProject;
  skipIfExists?: boolean;
}

/**
 * Single place to create an agent: generates nsec, publishes profile, updates agents.json
 */
export async function createAgent(
  options: CreateAgentOptions
): Promise<NDKPrivateKeySigner | undefined> {
  const { projectPath, projectTitle, agentName, agentEventId, projectEvent, skipIfExists } =
    options;
  const agentKey = toKebabCase(agentName);

  // Load current agents configuration
  const configuration = await configurationService.loadConfiguration(projectPath);
  const agents: AgentsJson = configuration.agents || {};

  // Check if agent already exists
  const existingAgent = agents[agentKey];
  if (existingAgent) {
    // Just update file reference if needed
    if (!existingAgent.file) {
      existingAgent.file = `${agentEventId}.json`;
      await configurationService.saveConfiguration(projectPath, { ...configuration, agents });
      logInfo(chalk.green(`✅ Added file reference for agent ${agentName}`));
    }
    if (skipIfExists) {
      const existingSigner = new NDKPrivateKeySigner(existingAgent.nsec);
      return existingSigner;
    }
    if (skipIfExists) {
      const existingSigner = new NDKPrivateKeySigner(existingAgent.nsec);
      return existingSigner;
    }
    return;
  }

  // Generate new nsec for this agent
  const signer = NDKPrivateKeySigner.generate();
  if (!signer.privateKey) {
    throw new Error("Failed to generate private key for agent");
  }

  // Update agents.json
  agents[agentKey] = {
    nsec: signer.nsec,
    file: agentEventId ? `${agentEventId}.json` : undefined,
  };

  await configurationService.saveConfiguration(projectPath, { ...configuration, agents });
  logInfo(chalk.green(`✅ Generated nsec for agent: ${agentName} (as '${agentKey}')`));

  // Publish kind:0 profile for the new agent
  try {
    const fullAgentName = `${agentKey} @ ${projectTitle}`;
    const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(fullAgentName)}`;

    const ndk = getNDK();
    const profileEvent = new NDKEvent(ndk, {
      kind: 0,
      content: JSON.stringify({
        name: fullAgentName,
        display_name: fullAgentName,
        about: `${agentKey} AI agent for ${projectTitle} project`,
        bot: true,
        picture: avatarUrl,
      }),
    });

    await profileEvent.sign(signer);
    profileEvent.publish();
    logInfo(chalk.green(`✅ Published kind:0 profile for ${agentName} agent`));

    // Publish kind 3199 agent request if we have project event
    if (projectEvent) {
      try {
        const agentRequestEvent = new NDKEvent(ndk, {
          kind: EVENT_KINDS.AGENT_REQUEST,
          tags: [
            ["agent-name", agentKey],
            ["e", agentEventId || ""],
          ],
        });

        agentRequestEvent.tag(projectEvent);
        agentRequestEvent.tag(projectEvent.author);

        await agentRequestEvent.sign(signer);
        await agentRequestEvent.publish();
        logInfo(chalk.green(`✅ Published kind:3199 agent request for ${agentName}`));
      } catch (err) {
        const errorMessage = formatError(err);
        logInfo(
          chalk.yellow(`⚠️  Failed to publish agent request for ${agentName}: ${errorMessage}`)
        );
      }
    }
  } catch (err) {
    const errorMessage = formatError(err);
    logInfo(chalk.yellow(`⚠️  Failed to publish profile for ${agentName}: ${errorMessage}`));
  }

  return signer;
}
