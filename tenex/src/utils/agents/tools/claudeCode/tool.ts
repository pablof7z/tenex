import { spawn } from "node:child_process";
import { ClaudeParser } from "@/utils/agents/tools/claude/ClaudeParser";
import type { ClaudeCodeMessage, ClaudeCodeOptions } from "@/utils/agents/tools/claudeCode/types";
import type { ToolContext, ToolDefinition } from "@/utils/agents/tools/types";
import { NDKTask } from "@nostr-dev-kit/ndk";
import { logDebug, logError, logInfo } from "@tenex/shared/logger";
import chalk from "chalk";

export const claudeCodeTool: ToolDefinition = {
  name: "claude_code",
  description:
    "Implement code changes by invoking Claude Code. Use this tool when you need to WRITE, MODIFY, CREATE code. Use claude_code for: writing new code, modifying existing files, debugging, refactoring, creating new features, fixing bugs, or any hands-on coding work.",
  parameters: [
    {
      name: "title",
      type: "string",
      description: "A concise title (3-8 words) describing what this code task will accomplish.",
      required: true,
    },
    {
      name: "prompt",
      type: "string",
      description:
        "The detailed prompt for Claude Code. Claude Code will determine what context and files it needs, provide as much information as possible. If you have a backtrace, debug logs, include them. If the human user provided information, make sure to include it verbatim.",
      required: true,
    },
  ],
  execute: async (params, toolContext?: ToolContext) => {
    const title = params.title as string;
    const prompt = params.prompt as string;

    logInfo(chalk.blue("\n🚀 Starting Claude Code..."));
    logDebug(chalk.gray(`Title: "${title}"`));
    logDebug(chalk.gray(`Prompt: "${prompt.substring(0, 100)}..."`));

    // Create NDKTask for this claude_code execution
    let taskEvent: NDKTask | undefined;
    if (
      toolContext?.ndk &&
      toolContext?.projectEvent &&
      toolContext?.rootEventId &&
      toolContext?.agent
    ) {
      try {
        taskEvent = new NDKTask(toolContext.ndk);
        taskEvent.title = title;
        taskEvent.content = prompt;

        // Tag the task with the project
        taskEvent.tag(toolContext.projectEvent);

        // E-tag the thread if we have a rootEventId
        taskEvent.tags.push(["e", toolContext.rootEventId]);

        // Add agent tag if available
        if (toolContext.agentName) {
          taskEvent.tags.push(["agent", toolContext.agentName]);
        }

        // Add tool tag to identify this as a claude_code task
        taskEvent.tags.push(["tool", "claude_code"]);

        // Sign and publish the task using agent's signer
        await taskEvent.sign(toolContext.agent.getSigner());
        await taskEvent.publish();

        logInfo(chalk.green(`📋 Created task: ${title}`));
        logDebug(chalk.gray(`Task ID: ${taskEvent.id}`));
      } catch (error) {
        logError(chalk.red(`Failed to create task: ${error}`));
        // Continue without task if creation fails
      }
    }

    try {
      const result = await executeClaudeCode(
        {
          prompt: prompt,
          verbose: true,
          outputFormat: "stream-json",
          dangerouslySkipPermissions: true,
        },
        toolContext,
        taskEvent
      );

      return {
        success: true,
        output: result,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "Claude Code execution failed",
      };
    }
  },
};

async function publishTaskUpdate(
  content: string,
  sessionId: string | undefined,
  toolContext?: ToolContext,
  taskEvent?: NDKTask
) {
  if (!taskEvent || !toolContext?.publisher || !toolContext?.agent) return;

  try {
    const updateContext = {
      originalEvent: taskEvent,
      projectEvent: toolContext.projectEvent,
      rootEventId: toolContext.rootEventId,
      projectId: toolContext.projectEvent.tagId(),
    };

    const response = {
      content,
      metadata: {
        isToolUpdate: true,
        tool: "claude_code",
      },
    };

    const extraTags: string[][] = [];
    if (sessionId) {
      extraTags.push(["claude-session-id", sessionId]);
    }

    await toolContext.publisher.publishResponse(
      response,
      updateContext,
      toolContext.agent.getSigner(),
      toolContext.agentName,
      extraTags
    );

    logDebug(chalk.gray(`Published task update: ${content.substring(0, 50)}...`));
  } catch (error) {
    logError(`Failed to publish task update: ${error}`);
  }
}

function formatText(text: string): string {
  const lines = text.split("\n");
  const trimmedLines = lines.map((line) => line.trimEnd());
  const formatted = trimmedLines.join("\n").trim();

  return formatted
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      return chalk.gray(`\`\`\`${lang || ""}\n`) + chalk.white(code) + chalk.gray("```");
    })
    .replace(/`([^`]+)`/g, (_match, code) => chalk.green(`\`${code}\``))
    .replace(/\*\*([^*]+)\*\*/g, (_match, text) => chalk.bold(text));
}

function executeClaudeCode(
  options: ClaudeCodeOptions,
  toolContext?: ToolContext,
  taskEvent?: NDKTask
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--dangerously-skip-permissions",
      "--output-format",
      "stream-json",
      "--verbose",
      options.prompt,
    ];

    logDebug(
      `${chalk.gray("Command:")} claude ${args.map((arg) => (arg.includes(" ") ? `'${arg}'` : arg)).join(" ")}`
    );
    logDebug(`${chalk.gray("Working directory:")} ${options.projectPath || process.cwd()}`);
    logInfo(chalk.yellow("\nExecuting Claude Code...\n"));

    const claudeProcess = spawn("claude", args, {
      cwd: options.projectPath || process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "inherit"],
    });

    logDebug(`${chalk.gray("Claude process PID:")} ${claudeProcess.pid}`);

    let finalResult = "";
    let hasError = false;

    // Create parser with message handler
    const parser = new ClaudeParser(async (message: ClaudeCodeMessage) => {
      switch (message.type) {
        case "assistant":
          if (message.message?.content) {
            for (const content of message.message.content) {
              if (content.type === "text" && content.text) {
                const formattedText = formatText(content.text);
                logInfo(`${chalk.cyan("\n🤖 Claude:")} ${formattedText}`);
                await publishTaskUpdate(
                  `🤖 **Claude Code**: ${content.text.trim()}`,
                  parser.getSessionId(),
                  toolContext,
                  taskEvent
                );
              }
            }

            // Show token usage
            if (message.message.usage) {
              const usage = message.message.usage;
              const tokens = [
                `Input: ${usage.input_tokens}`,
                usage.cache_read_input_tokens ? `Cached: ${usage.cache_read_input_tokens}` : null,
                `Output: ${usage.output_tokens}`,
              ]
                .filter(Boolean)
                .join(", ");
              logDebug(chalk.gray(`   [Tokens: ${tokens}]`));
            }
          }
          break;

        case "tool_use":
          logInfo(chalk.yellow("\n🔧 Tool Use Detected"));
          if (message.tool_use) {
            const toolName = message.tool_use.name || "tool";
            await publishTaskUpdate(
              `🔧 **Tool Use**: Using ${toolName}...`,
              parser.getSessionId(),
              toolContext,
              taskEvent
            );
          }
          break;

        case "result":
          if (message.result) {
            finalResult = message.result;
          }
          if (message.is_error) {
            hasError = true;
          }
          break;
      }
    });

    if (claudeProcess.stdout) {
      claudeProcess.stdout.setEncoding("utf8");
    }

    claudeProcess.stdout?.on("data", (chunk: string) => {
      parser.parseLines(chunk);
    });

    claudeProcess.on("close", async (code) => {
      if (code !== 0 || hasError) {
        await publishTaskUpdate(
          "❌ **Task Failed**: Error occurred during execution",
          parser.getSessionId(),
          toolContext,
          taskEvent
        );
        reject(new Error(`Claude Code exited with code ${code}`));
      } else {
        // Publish completion update
        const stats = [];
        if (parser.getMessageCount() > 0) {
          stats.push(`${parser.getMessageCount()} messages`);
        }
        if (parser.getTotalCost() > 0) {
          stats.push(`$${parser.getTotalCost().toFixed(4)}`);
        }
        const duration = (parser.getDuration() / 1000).toFixed(1);
        stats.push(`Duration: ${duration}s`);

        let completionMessage = "✅ **Task Complete**";
        if (finalResult) {
          completionMessage += `\n\n**Summary**: ${finalResult}`;
          logInfo(`${chalk.white("\nSummary:")} ${formatText(finalResult)}`);
        }
        if (stats.length > 0) {
          completionMessage += `\n\n**Stats**: ${stats.join(" | ")}`;
        }
        
        logInfo(chalk.green("\n\n✅ Task Complete"));
        logDebug(chalk.gray(`\n[${stats.join(" | ")}]`));

        await publishTaskUpdate(completionMessage, parser.getSessionId(), toolContext, taskEvent);

        const summary = stats.length > 0 ? ` (${stats.join(", ")})` : "";
        let result = finalResult || `Code task completed successfully${summary}`;

        const sessionId = parser.getSessionId();
        if (sessionId) {
          result += `\n\nSession ID: ${sessionId}`;
        }

        resolve(result);
      }
    });

    claudeProcess.on("error", (error) => {
      logError(`${chalk.red("Failed to start Claude Code:")} ${error.message}`);
      if (error.message.includes("ENOENT")) {
        logError(chalk.yellow("\nMake sure Claude CLI is installed and in your PATH"));
        logError(chalk.yellow("Install with: npm install -g @anthropic-ai/claude-cli"));
      }
      reject(new Error(`Failed to start Claude Code: ${error.message}`));
    });
  });
}
