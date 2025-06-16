import { Command } from "commander";
import { projectInitCommand } from "./init.js";
import { projectRunCommand } from "./run.js";

export const projectCommand = new Command("project")
    .description("Project management commands")
    .addCommand(projectInitCommand)
    .addCommand(projectRunCommand);
