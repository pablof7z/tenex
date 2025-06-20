import type { Agent, ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logInfo } from "@tenex/shared/logger";
import chalk from "chalk";

export class ProjectDisplay {
  async displayProjectInfo(projectInfo: ProjectRuntimeInfo): Promise<void> {
    this.displayBasicInfo(projectInfo);
    await this.displayAgentConfigurations(
      projectInfo.projectEvent,
      projectInfo.projectPath,
      projectInfo.agents
    );
    // Note: Documentation display moved to after subscription EOSE
    logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
  }

  private displayBasicInfo(projectInfo: ProjectRuntimeInfo): void {
    logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    logInfo(chalk.cyan("📦 Project Information"));
    logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    logInfo(chalk.gray("Title:      ") + chalk.white(projectInfo.title));
    logInfo(chalk.gray("Repository: ") + chalk.white(projectInfo.repository));
    logInfo(chalk.gray("Path:       ") + chalk.white(projectInfo.projectPath));
    if (projectInfo.projectEvent.id) {
      logInfo(
        chalk.gray("Event ID:   ") +
          chalk.gray(`${projectInfo.projectEvent.id.substring(0, 16)}...`)
      );
    }
  }

  private async displayAgentConfigurations(
    _projectEvent: NDKEvent,
    _projectPath: string,
    agents: Map<string, Agent>
  ): Promise<void> {
    if (agents.size === 0) {
      logInfo(chalk.yellow("No agent configurations found for this project."));
      return;
    }

    logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    logInfo(chalk.cyan("🤖 Agent Configurations"));
    logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

    for (const [, agent] of agents) {
      this.displayAgent(agent.eventId, agents);
    }
  }

  private displayAgent(eventId: string, agents: Map<string, Agent>): void {
    // Find agent by eventId
    const agentEntry = Array.from(agents.entries()).find(([, agent]) => agent.eventId === eventId);

    if (!agentEntry) {
      logInfo(chalk.red(`No agent instance found for event: ${eventId}`));
      return;
    }

    const [_agentKey, agent] = agentEntry;

    // Display agent information with instance pubkey
    logInfo(chalk.gray("\nAgent:       ") + chalk.yellow(agent.name));
    logInfo(chalk.gray("Description: ") + chalk.white(agent.description));
    if (agent.role) {
      logInfo(chalk.gray("Role:        ") + chalk.white(agent.role));
    }
    logInfo(chalk.gray("Pubkey:      ") + chalk.white(agent.pubkey));
    logInfo(chalk.gray("Cached:      ") + chalk.green(`✓ ${eventId}.json`));
  }
}
