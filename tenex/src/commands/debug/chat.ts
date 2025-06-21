import * as readline from "node:readline";
import { formatError } from "@/utils/errors";
import { logDebug, logError, logInfo } from "@tenex/shared/logger";
import chalk from "chalk";
import { createDebugAgentSystem } from "../../debug/createDebugAgentSystem";

interface DebugChatOptions {
  systemPrompt?: boolean;
  message?: string;
  llm?: string | boolean;
}

export async function runDebugChat(
  initialAgentName: string | undefined,
  options: DebugChatOptions
) {
  try {
    const projectPath = process.cwd();

    // Parse LLM options
    let llmProvider: string | undefined;
    let llmModel: string | undefined;

    if (typeof options.llm === "string") {
      const parts = options.llm.split(":");
      if (parts.length === 2) {
        [llmProvider, llmModel] = parts;
      } else {
        llmModel = options.llm;
      }
    }

    logInfo("Starting debug chat mode...");

    // Create debug agent system
    const { agent, llmService } = await createDebugAgentSystem({
      projectPath,
      agentName: initialAgentName,
      llmProvider,
      llmModel,
    });

    // Show system prompt if requested
    if (options.systemPrompt) {
      console.log(chalk.cyan("\n=== System Prompt ==="));
      console.log(agent.getSystemPrompt());
      console.log(chalk.cyan("===================\n"));
    }

    // Handle single message mode
    if (options.message) {
      logDebug("Processing single message:", "general", "debug", options.message);
      const response = await agent.sendMessage(options.message);
      console.log(chalk.green("\nAgent:"), response.message);
      return;
    }

    // Interactive REPL mode
    console.log(chalk.cyan(`\nDebug Chat - Agent: ${agent.getName()}`));
    console.log(chalk.gray("Type 'exit' or 'quit' to end the conversation"));
    console.log(chalk.gray("Type 'clear' to clear conversation history"));
    console.log(chalk.gray("Type 'history' to view conversation history"));
    console.log(chalk.gray("Type 'prompt' to view system prompt\n"));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.blue("You> "),
    });

    rl.prompt();

    rl.on("line", async (line) => {
      const input = line.trim();

      // Handle special commands
      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        console.log(chalk.yellow("\nExiting debug chat..."));
        rl.close();
        return;
      }

      if (input.toLowerCase() === "clear") {
        agent.clearHistory();
        console.log(chalk.yellow("Conversation history cleared.\n"));
        rl.prompt();
        return;
      }

      if (input.toLowerCase() === "history") {
        const history = agent.getHistory();
        console.log(chalk.cyan("\n=== Conversation History ==="));
        history.forEach((msg, idx) => {
          console.log(chalk.gray(`[${idx}] ${msg.role}:`), msg.content);
        });
        console.log(chalk.cyan("========================\n"));
        rl.prompt();
        return;
      }

      if (input.toLowerCase() === "prompt") {
        console.log(chalk.cyan("\n=== System Prompt ==="));
        console.log(agent.getSystemPrompt());
        console.log(chalk.cyan("===================\n"));
        rl.prompt();
        return;
      }

      // Skip empty inputs
      if (!input) {
        rl.prompt();
        return;
      }

      try {
        // Show thinking indicator
        process.stdout.write(chalk.gray("Agent is thinking..."));

        // Get response from agent
        const response = await agent.sendMessage(input);

        // Clear thinking indicator
        process.stdout.write(`\r${" ".repeat(20)}\r`);

        // Display response
        console.log(chalk.green("Agent:"), response.message);

        // Tool calls are not yet supported in the debug chat
        // TODO: Show tool usage when multi-llm-ts supports tool calls

        console.log(); // Empty line for readability
      } catch (error) {
        console.error(chalk.red("\nError:"), formatError(error));
      }

      rl.prompt();
    });

    rl.on("close", () => {
      console.log(chalk.yellow("\nDebug chat ended."));
      process.exit(0);
    });
  } catch (err) {
    const errorMessage = formatError(err);
    logError(`Failed to start debug chat: ${errorMessage}`);
    process.exit(1);
  }
}
