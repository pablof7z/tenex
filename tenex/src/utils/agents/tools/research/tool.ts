import { spawn } from "node:child_process";
import { ClaudeParser } from "@/utils/agents/tools/claude/ClaudeParser";
import type { ClaudeCodeMessage } from "@/utils/agents/tools/claudeCode/types";
import type { ResearchOptions } from "@/utils/agents/tools/research/types";
import type { ToolContext, ToolDefinition } from "@/utils/agents/tools/types";
import { NDKTask } from "@nostr-dev-kit/ndk";
import { logDebug, logError, logInfo } from "@tenex/shared/logger";
import chalk from "chalk";

export const researchTool: ToolDefinition = {
  name: "research",
  description:
    "Generate a comprehensive markdown research report about the current codebase based on the provided query. This tool uses Claude to analyze the codebase and produce a detailed markdown report covering the requested topic. Use this tool for: analyzing architecture, documenting patterns, researching specific functionality, understanding code structure, or generating technical documentation.",
  parameters: [
    {
      name: "query",
      type: "string",
      description:
        "The research query describing what you want to analyze about the codebase. Be specific about what aspects you want to research (e.g., 'authentication system architecture', 'database connection patterns', 'API endpoint documentation').",
      required: true,
    },
  ],
  execute: async (params, toolContext?: ToolContext) => {
    const query = params.query as string;

    logInfo(chalk.blue("\n🔍 Starting Research..."));
    logDebug(chalk.gray(`Query: "${query}"`));

    // Create NDKTask for this research execution
    let taskEvent: NDKTask | undefined;
    if (
      toolContext?.ndk &&
      toolContext?.projectEvent &&
      toolContext?.rootEventId &&
      toolContext?.agent
    ) {
      try {
        taskEvent = new NDKTask(toolContext.ndk);
        taskEvent.title = `Research: ${query}`;
        taskEvent.content = `Generating research report for: ${query}`;

        // Tag the task with the project
        taskEvent.tag(toolContext.projectEvent);

        // E-tag the thread if we have a rootEventId
        taskEvent.tags.push(["e", toolContext.rootEventId]);

        // Add agent tag if available
        if (toolContext.agentName) {
          taskEvent.tags.push(["agent", toolContext.agentName]);
        }

        // Add tool tag to identify this as a research task
        taskEvent.tags.push(["tool", "research"]);

        // Sign and publish the task using agent's signer
        await taskEvent.sign(toolContext.agent.getSigner());
        await taskEvent.publish();

        logInfo(chalk.green(`📋 Created research task: ${query}`));
        logDebug(chalk.gray(`Task ID: ${taskEvent.id}`));
      } catch (error) {
        logError(chalk.red(`Failed to create task: ${error}`));
        // Continue without task if creation fails
      }
    }

    try {
      const result = await executeResearch(
        {
          query: query,
          verbose: true,
          outputFormat: "markdown",
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
        error: error instanceof Error ? error.message : "Research execution failed",
      };
    }
  },
};

async function publishResearchUpdate(
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
      rootEventId: toolContext.rootEventId || "",
      projectId: toolContext.projectEvent.tagId(),
    };

    const response = {
      content,
      metadata: {
        isToolUpdate: true,
        tool: "research",
      } as any,
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

    logDebug(chalk.gray(`Published research update: ${content.substring(0, 50)}...`));
  } catch (error) {
    logError(`Failed to publish research update: ${error}`);
  }
}

function executeResearch(
  options: ResearchOptions,
  toolContext?: ToolContext,
  taskEvent?: NDKTask
): Promise<string> {
  return new Promise((resolve, reject) => {
    const researchPrompt = `Please analyze the current codebase and generate a comprehensive markdown research report about: ${options.query}

Your response should be formatted as a well-structured markdown document with:
- Clear headings and subheadings
- Code examples where relevant
- Bullet points for key findings
- Sections for different aspects of the topic
- Proper markdown formatting throughout

When asked to plan how to properly implement a feature, come up with as many different approaches as possible, outlining the pros and cons of each approach, and then recommend the best approach based on the analysis.

Query: ${options.query}`;

    const args = [
      "-p",
      "--dangerously-skip-permissions",
      "--output-format",
      "stream-json",
      "--verbose",
      researchPrompt,
    ];

    logDebug(
      `${chalk.gray("Command:")} claude ${args.map((arg) => (arg.includes(" ") ? `'${arg}'` : arg)).join(" ")}`
    );
    logDebug(`${chalk.gray("Working directory:")} ${options.projectPath || process.cwd()}`);
    logInfo(chalk.yellow("\nExecuting Research via Claude Code...\n"));

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
                await publishResearchUpdate(
                  `🔍 **Research Progress**: ${content.text.substring(0, 200)}...`,
                  parser.getSessionId(),
                  toolContext,
                  taskEvent
                );
              }
            }
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
        await publishResearchUpdate(
          "❌ **Research Failed**: Error occurred during research",
          parser.getSessionId(),
          toolContext,
          taskEvent
        );
        reject(new Error(`Research execution failed with code ${code}`));
      } else {
        await publishResearchUpdate(
          "✅ **Research Complete**: Report generated successfully",
          parser.getSessionId(),
          toolContext,
          taskEvent
        );

        const stats = [];
        if (parser.getMessageCount() > 0) {
          stats.push(`${parser.getMessageCount()} messages`);
        }
        if (parser.getTotalCost() > 0) {
          stats.push(`$${parser.getTotalCost().toFixed(4)}`);
        }

        const summary = stats.length > 0 ? ` (${stats.join(", ")})` : "";
        let result = finalResult || `Research completed successfully${summary}`;

        const sessionId = parser.getSessionId();
        if (sessionId) {
          result += `\n\nSession ID: ${sessionId}`;
        }

        resolve(result);
      }
    });

    claudeProcess.on("error", (error) => {
      logError(`${chalk.red("Failed to start research:")} ${error.message}`);
      if (error.message.includes("ENOENT")) {
        logError(chalk.yellow("\nMake sure Claude CLI is installed and in your PATH"));
        logError(chalk.yellow("Install with: npm install -g @anthropic-ai/claude-cli"));
      }
      reject(new Error(`Failed to start research: ${error.message}`));
    });
  });
}
