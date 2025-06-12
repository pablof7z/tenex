import { Command } from "commander";
import { addCommand } from "./add";
import { getCommand } from "./get";
import { listCommand } from "./list";

export const rulesCommand = new Command("rules")
	.description("Manage project rules/instructions")
	.addCommand(addCommand)
	.addCommand(getCommand)
	.addCommand(listCommand);
