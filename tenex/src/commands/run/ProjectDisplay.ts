import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "@/utils/logger";
const logInfo = logger.info.bind(logger);
import chalk from "chalk";
import { getProjectContext } from "@/services";
import type { Agent } from "@/agents/types";

export class ProjectDisplay {
  async displayProjectInfo(projectPath: string): Promise<void> {
    this.displayBasicInfo(projectPath);
    await this.displayAgentConfigurations();
    // Note: Documentation display moved to after subscription EOSE
    logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
  }

  private displayBasicInfo(projectPath: string): void {
    const projectCtx = getProjectContext();
    const project = projectCtx.project;
    const titleTag = project.tagValue("title") || "Untitled Project";
    const repoTag = project.tagValue("repo") || "No repository";

    logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    logInfo(chalk.cyan("📦 Project Information"));
    logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    logInfo(chalk.gray("Title:      ") + chalk.white(titleTag));
    logInfo(chalk.gray("Repository: ") + chalk.white(repoTag));
    logInfo(chalk.gray("Path:       ") + chalk.white(projectPath));
    if (project.id) {
      logInfo(chalk.gray("Event ID:   ") + chalk.gray(`${project.id.substring(0, 16)}...`));
    }
  }

  private async displayAgentConfigurations(): Promise<void> {
    const projectCtx = getProjectContext();
    const agents = projectCtx.agents;
    if (agents.size === 0) {
      logInfo(chalk.yellow("No agent configurations found for this project."));
      return;
    }

    logInfo(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    logInfo(chalk.cyan("🤖 Agent Configurations"));
    logInfo(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

    for (const [, agent] of agents) {
      if (agent.eventId) {
        this.displayAgent(agent.eventId, agents);
      }
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
    logInfo(chalk.gray("Expertise:   ") + chalk.white(agent.expertise));
    if (agent.role) {
      logInfo(chalk.gray("Role:        ") + chalk.white(agent.role));
    }
    logInfo(chalk.gray("Pubkey:      ") + chalk.white(agent.pubkey));
    logInfo(chalk.gray("Cached:      ") + chalk.green(`✓ ${eventId}.json`));
  }
}
