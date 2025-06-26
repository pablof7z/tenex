import { projectInitCommand } from "@/commands/project/init";
import { projectRunCommand } from "@/commands/project/run";
import { agentCommand } from "@/commands/project/agent";
import { projectExecuteCommand } from "@/commands/project/execute";
import { Command } from "commander";

export const projectCommand = new Command("project")
    .description("Project management commands")
    .addCommand(projectInitCommand)
    .addCommand(projectRunCommand)
    .addCommand(agentCommand)
    .addCommand(projectExecuteCommand);
