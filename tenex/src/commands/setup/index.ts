import { llmCommand } from "@/commands/setup/llm";
import { telemetryCommand } from "@/commands/setup/telemetry";
import { Command } from "commander";

export const setupCommand = new Command("setup")
    .description("Setup and configuration commands")
    .addCommand(llmCommand)
    .addCommand(telemetryCommand);
