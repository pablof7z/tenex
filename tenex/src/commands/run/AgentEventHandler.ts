import path from "node:path";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import { toKebabCase } from "@/utils/agents";
import { formatError } from "@/utils/errors";
import { type NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { ensureDirectory, readJsonFile, writeJsonFile } from "@tenex/shared/fs";
import { logError, logInfo, logSuccess, logWarning } from "@tenex/shared/logger";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";

export interface AgentDefinition {
    eventId: string;
    name: string;
    description: string;
    role: string;
    instructions: string;
    version: string;
    systemPrompt: string;
}

export class AgentEventHandler {
    async handleAgentEvent(event: NDKEvent, projectInfo: ProjectRuntimeInfo): Promise<void> {
        try {
            if (!this.validateAgentEvent(event, projectInfo)) {
                return;
            }

            const agentName = event.tags.find((tag) => tag[0] === "title")?.[1];
            if (!agentName) {
                logError("Agent event missing title tag");
                return;
            }

            const agentDefinition = this.extractAgentDefinition(event);
            await this.saveAgentConfiguration(agentDefinition, projectInfo.projectPath);
            await this.ensureAgentHasNsec(agentName, event.id, projectInfo.projectPath);

            logInfo(chalk.gray("Agent:   ") + chalk.magenta(agentName));
            logInfo(chalk.gray("Desc:    ") + chalk.white(agentDefinition.description));
            logSuccess(`Saved agent configuration: ${agentName}`);
        } catch (err) {
            const errorMessage = formatError(err);
            logError(`Failed to handle agent event: ${errorMessage}`);
        }
    }

    private validateAgentEvent(event: NDKEvent, projectInfo: ProjectRuntimeInfo): boolean {
        if (event.kind !== EVENT_KINDS.AGENT_CONFIG) {
            logError("Event is not an NDKAgent event");
            return false;
        }

        const aTag = event.tags.find((tag) => tag[0] === "a");
        if (!aTag || !aTag[1] || !aTag[1].includes(`31933:${projectInfo.projectPubkey}:`)) {
            logWarning("Agent event does not reference this project");
            return false;
        }

        return true;
    }

    private extractAgentDefinition(event: NDKEvent): AgentDefinition {
        const agentName = event.tags.find((tag) => tag[0] === "title")?.[1] || "unnamed";

        return {
            eventId: event.id,
            name: agentName,
            description: event.tags.find((tag) => tag[0] === "description")?.[1] || "",
            role: event.tags.find((tag) => tag[0] === "role")?.[1] || "",
            instructions: event.content || "",
            version: event.tags.find((tag) => tag[0] === "ver")?.[1] || "1",
            systemPrompt: event.content || "",
        };
    }

    private async saveAgentConfiguration(
        agentDefinition: AgentDefinition,
        projectPath: string
    ): Promise<void> {
        const agentsDir = path.join(projectPath, ".tenex", "agents");
        await ensureDirectory(agentsDir);

        // Save with event ID only
        const eventFile = path.join(agentsDir, `${agentDefinition.eventId}.json`);
        await writeJsonFile(eventFile, agentDefinition);
    }

    private async ensureAgentHasNsec(
        agentName: string,
        eventId: string,
        projectPath: string
    ): Promise<void> {
        const agentsPath = path.join(projectPath, ".tenex", "agents.json");
        const agentKey = toKebabCase(agentName);

        interface AgentConfigEntry {
            nsec: string;
            file?: string;
        }

        interface AgentsJsonConfig {
            [agentName: string]: string | AgentConfigEntry;
        }

        let agents: AgentsJsonConfig = {};

        const existingAgents = await readJsonFile<AgentsJsonConfig>(agentsPath);
        agents = existingAgents || {};

        const agentEntry = agents[agentKey];

        if (!agentEntry) {
            // Create new agent entry
            const signer = NDKPrivateKeySigner.generate();
            agents[agentKey] = {
                nsec: signer.nsec,
                file: `${eventId}.json`,
            };

            await writeJsonFile(agentsPath, agents);
            logSuccess(`Generated nsec for agent: ${agentName} (as '${agentKey}')`);
        } else if (typeof agentEntry === "string") {
            // Old format - convert to new format
            agents[agentKey] = {
                nsec: agentEntry,
                file: `${eventId}.json`,
            };

            await writeJsonFile(agentsPath, agents);
            logSuccess(`Updated agent ${agentName} to new format`);
        } else {
            // New format - check if file reference needs updating
            if (!agentEntry.file || agentEntry.file !== `${eventId}.json`) {
                agentEntry.file = `${eventId}.json`;
                await writeJsonFile(agentsPath, agents);
                logSuccess(`Updated file reference for agent ${agentName}`);
            }
        }
    }
}
