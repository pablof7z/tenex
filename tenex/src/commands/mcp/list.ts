import { configService } from "@/services/ConfigService";
import { logger } from "@/utils/logger";
import chalk from "chalk";
import { Command } from "commander";

interface ListOptions {
  project?: boolean;
}

export const listCommand = new Command("list")
  .description("List configured MCP servers")
  .option("--project", "Show only project servers")
  .action(async (options: ListOptions) => {
    try {
      const projectPath = process.cwd();
      const isProject = await configService.projectConfigExists(projectPath, "config.json");

      // Load configurations
      const config = await configService.loadConfig(
        isProject && !options.project ? projectPath : undefined
      );

      if (!config.mcp || Object.keys(config.mcp.servers).length === 0) {
        logger.info("No MCP servers configured");
        process.exit(0);
      }

      // Display header
      logger.info(chalk.bold("\nConfigured MCP Servers:"));
      logger.info(chalk.gray("─".repeat(60)));

      // Group servers by source (global vs project)
      const globalPath = configService.getGlobalPath();
      const globalMCP = await configService.loadTenexMCP(globalPath);
      const projectMCP = isProject
        ? await configService.loadTenexMCP(configService.getProjectPath(projectPath))
        : { servers: {}, enabled: true };

      // Display global servers
      if (!options.project && Object.keys(globalMCP.servers).length > 0) {
        logger.info(chalk.yellow("\nGlobal servers:"));
        for (const [name, server] of Object.entries(globalMCP.servers)) {
          displayServer(name, server);
        }
      }

      // Display project servers
      if (isProject && Object.keys(projectMCP.servers).length > 0) {
        logger.info(chalk.blue("\nProject servers:"));
        for (const [name, server] of Object.entries(projectMCP.servers)) {
          displayServer(name, server);
        }
      }

      // Display status
      logger.info(chalk.gray("\n─".repeat(60)));
      logger.info(`MCP enabled: ${config.mcp.enabled ? chalk.green("yes") : chalk.red("no")}`);
      logger.info(`Total servers: ${Object.keys(config.mcp.servers).length}`);

      // Exit successfully
      process.exit(0);
    } catch (error) {
      logger.error("Failed to list MCP servers:", error);
      process.exit(1);
    }
  });

function displayServer(name: string, server: MCPServerConfig): void {
  logger.info(`\n  ${chalk.bold(name)}`);
  logger.info(`    Command: ${chalk.cyan(`${server.command} ${server.args.join(" ")}`)}`);

  if (server.description) {
    logger.info(`    Description: ${server.description}`);
  }

  if (server.allowedPaths && server.allowedPaths.length > 0) {
    logger.info(`    Allowed paths: ${server.allowedPaths.join(", ")}`);
  }

  if (server.env && Object.keys(server.env).length > 0) {
    logger.info(`    Environment: ${Object.keys(server.env).join(", ")}`);
  }
}

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  description?: string;
  allowedPaths?: string[];
}
