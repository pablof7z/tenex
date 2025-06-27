import { Command } from "commander";
import { input } from "@inquirer/prompts";
import { logger } from "@/utils/logger";
import { configService } from "@/services/ConfigService";
import type { MCPServerConfig } from "@/services/config/types";
import { which } from "@/lib/shell";

interface AddOptions {
    project?: boolean;
    global?: boolean;
}

export const addCommand = new Command("add")
    .description("Add a new MCP server")
    .argument("[command...]", "Command with arguments to run the MCP server")
    .option("--project", "Add to project configuration (default if in project)")
    .option("--global", "Add to global configuration")
    .action(async (commandArgs: string[], options: AddOptions) => {
        try {
            // Parse command and args
            let command: string;
            let args: string[] = [];
            
            if (commandArgs.length === 0) {
                logger.error("No command provided");
                logger.info("Usage: tenex mcp add <command> [args...]");
                logger.info("Example: tenex mcp add npx -y @modelcontextprotocol/server-filesystem /path/to/dir");
                process.exit(1);
            }
            
            command = commandArgs[0] as string; // Safe because we checked length above
            args = commandArgs.slice(1);

            // Validate command exists (skip for npx, npm, etc.)
            const skipValidation = ["npx", "npm", "node", "python", "python3", "ruby", "sh", "bash"];
            if (!skipValidation.includes(command)) {
                const commandPath = await which(command);
                if (!commandPath) {
                    logger.error(`Command not found: ${command}`);
                    logger.info("Make sure the command is installed and in your PATH");
                    process.exit(1);
                }
            }

            // Prompt for server name
            const name = await input({
                message: "Server name:",
                validate: (value) => {
                    const trimmed = value.trim();
                    if (!trimmed) return "Name is required";
                    if (!/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
                        return "Name can only contain letters, numbers, hyphens, and underscores";
                    }
                    return true;
                },
            });

            // Prompt for description
            const description = await input({
                message: "Description (optional):",
            });

            // Prompt for allowed paths
            const allowedPathsInput = await input({
                message: "Allowed paths (optional, comma-separated):",
            });
            const allowedPaths = allowedPathsInput
                .split(",")
                .map(p => p.trim())
                .filter(p => p.length > 0);

            // Create server config
            const serverConfig: MCPServerConfig = {
                command,
                args,
                ...(description && { description }),
                ...(allowedPaths.length > 0 && { allowedPaths }),
            };

            // Determine where to save
            const projectPath = process.cwd();
            const isProject = await configService.projectConfigExists(projectPath, "config.json");
            
            let useProject = false;
            if (options.global && options.project) {
                logger.error("Cannot use both --global and --project flags");
                process.exit(1);
            } else if (options.global) {
                useProject = false;
            } else if (options.project) {
                if (!isProject) {
                    logger.error("Not in a TENEX project directory. Use --global flag or run from a project.");
                    process.exit(1);
                }
                useProject = true;
            } else {
                // Default: use project if in one, otherwise global
                useProject = isProject;
            }

            // Load existing MCP config
            const basePath = useProject 
                ? configService.getProjectPath(projectPath)
                : configService.getGlobalPath();
            const existingMCP = await configService.loadTenexMCP(basePath);

            // Check if server name already exists
            if (existingMCP.servers[name]) {
                logger.error(`MCP server '${name}' already exists`);
                process.exit(1);
            }

            // Add new server
            existingMCP.servers[name] = serverConfig;

            // Save config
            if (useProject) {
                await configService.saveProjectMCP(projectPath, existingMCP);
                logger.info(`Added MCP server '${name}' to project configuration`);
            } else {
                await configService.saveGlobalMCP(existingMCP);
                logger.info(`Added MCP server '${name}' to global configuration`);
            }

            logger.info(`Command: ${command} ${args.join(" ")}`);
            if (description) {
                logger.info(`Description: ${description}`);
            }
            if (allowedPaths.length > 0) {
                logger.info(`Allowed paths: ${allowedPaths.join(", ")}`);
            }
        } catch (error) {
            logger.error("Failed to add MCP server:", error);
            process.exit(1);
        }
    });