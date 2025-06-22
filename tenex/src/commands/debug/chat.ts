import * as readline from "node:readline";
import { AgentRegistry } from "@/agents/AgentRegistry";
import { AgentExecutor } from "@/agents/execution/AgentExecutor";
import type { AgentExecutionContext } from "@/agents/execution/types";
import { PromptBuilder } from "@/prompts";
import { getProjectContext as getRuntimeContext } from "@/runtime";
import { inventoryExists } from "@/utils/inventory";
import { ConversationManager } from "@/conversations/ConversationManager";
import type { ConversationState } from "@/conversations/types";
import { ConversationPublisher } from "@/nostr/ConversationPublisher";
import { getNDK, initNDK } from "@/nostr/ndkClient";
import { MultiLLMService } from "@/core/llm/MultiLLMService";
import type { LLMService } from "@/core/llm/types";
import { getProjectContext } from "@/runtime";
import { projectContext, configService } from "@/services";
import path from "node:path";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { formatError } from "@/utils/errors";
import { logDebug, logError, logInfo } from "@/utils/logger";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";

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

    // Parse LLM options - --llm should specify a preset name from llms.json
    let llmPresetOverride: string | undefined;
    if (typeof options.llm === "string") {
      llmPresetOverride = options.llm;
    }

    logInfo("Starting debug chat mode...");

    // Load LLM configuration from ProjectContext if available, otherwise from config files
    let llmSettings;
    if (projectContext.isInitialized()) {
      const { llms } = await configService.loadConfig(projectPath);
      llmSettings = llms;
    } else {
      const { llms } = await configService.loadConfig(projectPath);
      llmSettings = llms;
    }
    
    if (!llmSettings) {
      throw new Error("Failed to load LLM configuration");
    }
    
    // Initialize LLM service instances based on configuration
    const llmInstances = new Map<string, MultiLLMService>();
    
    // Create MultiLLMService instances for each configuration
    for (const [configName, config] of Object.entries(llmSettings.configurations)) {
      const credentials = llmSettings.credentials[config.provider];
      if (!credentials?.apiKey) {
        logError(`Missing API key for provider ${config.provider} in config ${configName}`);
        continue;
      }
      
      const llmInstance = new MultiLLMService({
        provider: config.provider as "anthropic" | "openai" | "google" | "ollama" | "mistral" | "groq" | "openrouter",
        model: config.model,
        apiKey: credentials.apiKey,
        baseUrl: credentials.baseUrl,
        defaultOptions: {
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
      });
      llmInstances.set(configName, llmInstance);
    }
    
    // Create LLM service that routes to the correct instance
    const llmService: LLMService = {
      async complete(request) {
        // Determine which config to use
        const configKey = typeof request === "string" ? request : 
          (agent.llmConfig || llmSettings.defaults?.agents || "default");
        
        const llmInstance = llmInstances.get(configKey);
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        return llmInstance.complete(request);
      },
      
      async *stream(request) {
        // Determine which config to use
        const configKey = typeof request === "string" ? request : 
          (agent.llmConfig || llmSettings.defaults?.agents || "default");
        
        const llmInstance = llmInstances.get(configKey);
        if (!llmInstance) {
          throw new Error(`LLM configuration '${configKey}' not found`);
        }
        
        yield* llmInstance.stream(request);
      },
    };

    // Get project context
    const projectCtx = await getProjectContext();

    // Load agent from registry or create default
    const agentRegistry = new AgentRegistry(projectPath);
    await agentRegistry.loadFromProject();

    let agent: Agent;

    if (initialAgentName) {
      const existingAgent = agentRegistry.getAgent(initialAgentName);
      if (!existingAgent) {
        throw new Error(`Agent '${initialAgentName}' not found`);
      }
      // Use the existing agent but potentially override llmConfig if --llm specified
      agent = llmPresetOverride ? { ...existingAgent, llmConfig: llmPresetOverride } : existingAgent;
    } else {
      // Create default debug agent
      agent = {
        name: "Debug Agent",
        role: "debug-agent",
        pubkey: projectCtx.projectSigner.pubkey,
        signer: projectCtx.projectSigner,
        llmConfig: llmPresetOverride || llmSettings.defaults?.agents || "default",
        tools: [],
        instructions: "You are a debug agent for testing purposes.",
        expertise: "Testing and debugging agent functionality",
      };
    }

    // Create conversation state for AgentExecutor
    const conversationId = uuidv4();
    const conversationManager = new ConversationManager(projectPath);
    const conversation: ConversationState = {
      id: conversationId,
      title: "Debug Chat Session",
      phase: "chat" as Phase,
      history: [],
      currentAgent: agent.pubkey,
      phaseStartedAt: Date.now(),
      metadata: {
        projectPath,
      },
    };

    // Initialize NDK and ConversationPublisher for AgentExecutor
    await initNDK();
    const ndk = getNDK();
    const conversationPublisher = new ConversationPublisher(projectCtx, ndk);
    
    // Initialize AgentExecutor
    const agentExecutor = new AgentExecutor(llmService, conversationPublisher);
    
    // Track messages separately for interactive mode
    const messages: Array<{ role: string; content: string }> = [];

    // Show system prompt if requested
    if (options.systemPrompt) {
      const projectContext = getRuntimeContext();
      let inventoryPrompt: string | undefined;
      if (await inventoryExists(projectContext.projectPath)) {
        inventoryPrompt = "## Project Inventory\n\nAn inventory file exists for this project. To get detailed project structure and file information, please refer to the inventory file generated by Claude Code.";
      }

      const systemPrompt = new PromptBuilder()
        .add("agent-system-prompt", {
          agent,
          phase: "chat" as Phase,
          projectTitle: projectContext.title,
          projectRepository: projectContext.repository,
          inventoryPrompt,
        })
        .build();

      console.log(chalk.cyan("\n=== System Prompt ==="));
      console.log(systemPrompt);
      console.log(chalk.cyan("===================\n"));
    }

    // Handle single message mode
    if (options.message) {
      logDebug("Processing single message:", "general", "debug", options.message);
      
      // Create execution context
      const context: AgentExecutionContext = {
        agent,
        conversation,
        phase: "chat" as Phase,
        lastUserMessage: options.message,
        projectContext: { projectPath },
      };

      // Create a mock NDKEvent for the debug session
      const mockEvent = new NDKEvent();
      mockEvent.kind = 9000; // Tenex conversation event kind
      mockEvent.content = options.message;
      mockEvent.pubkey = agent.pubkey;
      mockEvent.created_at = Math.floor(Date.now() / 1000);
      mockEvent.tags = [
        ["conversation", conversationId],
        ["phase", "chat"],
      ];

      // Execute using AgentExecutor without parent tracing context
      const result = await agentExecutor.execute(context, mockEvent, undefined);

      if (result.success && result.response) {
        console.log(chalk.green("\nAgent:"), result.response);

        if (result.toolExecutions && result.toolExecutions.length > 0) {
          console.log(chalk.gray("\nTools executed:"));
          result.toolExecutions.forEach((toolResult, idx) => {
            console.log(
              chalk.gray(
                `  ${idx + 1}. ${toolResult.toolName} ${toolResult.success ? "✓" : "✗"}${toolResult.error ? `: ${toolResult.error}` : ""}`
              )
            );
          });
        }
      } else if (result.error) {
        console.error(chalk.red("\nError:"), result.error);
      }
      return;
    }

    // Interactive REPL mode
    console.log(chalk.cyan(`\nDebug Chat - Agent: ${agent.name}`));
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
        messages.length = 0;
        conversation.history = [];
        console.log(chalk.yellow("Conversation history cleared.\n"));
        rl.prompt();
        return;
      }

      if (input.toLowerCase() === "history") {
        console.log(chalk.cyan("\n=== Conversation History ==="));
        messages.forEach((msg, idx) => {
          console.log(chalk.gray(`[${idx}] ${msg.role}:`), msg.content);
        });
        console.log(chalk.cyan("========================\n"));
        rl.prompt();
        return;
      }

      if (input.toLowerCase() === "prompt") {
        const projectContext = getRuntimeContext();
        let inventoryPrompt: string | undefined;
        if (await inventoryExists(projectContext.projectPath)) {
          inventoryPrompt = "## Project Inventory\n\nAn inventory file exists for this project. To get detailed project structure and file information, please refer to the inventory file generated by Claude Code.";
        }

        const systemPrompt = new PromptBuilder()
          .add("agent-system-prompt", {
            agent,
            phase: "chat" as Phase,
            projectTitle: projectContext.title,
            projectRepository: projectContext.repository,
            inventoryPrompt,
          })
          .build();

        console.log(chalk.cyan("\n=== System Prompt ==="));
        console.log(systemPrompt);
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

        // Add user message to tracking
        messages.push({ role: "user", content: input });

        // Create execution context
        const context: AgentExecutionContext = {
          agent,
          conversation,
          phase: "chat" as Phase,
          lastUserMessage: input,
          projectContext: { projectPath },
        };

        // Create a mock NDKEvent for the user message
        const mockEvent = new NDKEvent();
        mockEvent.kind = 9000; // Tenex conversation event kind
        mockEvent.content = input;
        mockEvent.pubkey = agent.pubkey;
        mockEvent.created_at = Math.floor(Date.now() / 1000);
        mockEvent.tags = [
          ["conversation", conversationId],
          ["phase", "chat"],
        ];

        // Execute using AgentExecutor without parent tracing context
        const result = await agentExecutor.execute(context, mockEvent, undefined);

        // Clear thinking indicator
        process.stdout.write(`\r${" ".repeat(20)}\r`);

        if (result.success && result.response) {
          // Add assistant response to tracking
          messages.push({ role: "assistant", content: result.response });

          // Display response
          console.log(chalk.green("Agent:"), result.response);

          // Show tool execution summary
          if (result.toolExecutions && result.toolExecutions.length > 0) {
            console.log(chalk.gray("\nTools executed:"));
            for (const toolResult of result.toolExecutions) {
              console.log(
                chalk.gray(`  - ${toolResult.toolName} ${toolResult.success ? "✓" : "✗"}${toolResult.error ? `: ${toolResult.error}` : ""}`)
              );
            }
          }
        } else if (result.error) {
          console.error(chalk.red("\nError:"), result.error);
        }

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

