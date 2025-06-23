import { Command } from "commander";
import { agentAddCommand } from "./add";

export const agentCommand = new Command("agent")
  .description("Agent management commands")
  .addCommand(agentAddCommand);