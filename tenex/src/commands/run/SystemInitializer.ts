import { ConversationManager } from "@/conversations";
import { MultiLLMService } from "@/llm/MultiLLMService";
import type { LLMService } from "@/llm/types";
import { ConversationPublisher, TypingIndicatorPublisher } from "@/nostr";
import { getNDK } from "@/nostr/ndkClient";
import { ConversationRouter, RoutingLLM } from "@/routing";
import { configService, projectContext } from "@/services";
import type { TenexLLMs } from "@/services/config/types";
import { logInfo } from "@/utils/logger";

export interface SystemComponents {
  conversationManager: ConversationManager;
  llmService: LLMService;
  routingLLM: RoutingLLM;
  conversationRouter: ConversationRouter;
  conversationPublisher: ConversationPublisher;
  llmSettings: TenexLLMs;
}

export class SystemInitializer {
  constructor(private projectPath: string) {}

  async initialize(): Promise<SystemComponents> {
    // Initialize conversation manager
    const conversationManager = new ConversationManager(this.projectPath);
    await conversationManager.initialize();

    // Load LLM configuration
    const { llms } = await configService.loadConfig(this.projectPath);
    const llmSettings = llms;

    // Create LLM service
    const llmService = await MultiLLMService.createForProject(this.projectPath);

    // Initialize routing system
    const routingConfig = this.getRoutingConfig(llmSettings);
    const routingLLM = new RoutingLLM(llmService, routingConfig, this.projectPath);
    logInfo(`Initialized RoutingLLM with configuration: ${routingConfig}`);

    // Get project context
    const project = projectContext.getCurrentProject();

    // Verify project event ID
    if (!project.id) {
      throw new Error("Project event ID is required but was not found");
    }

    // Create conversation publisher
    const conversationPublisher = new ConversationPublisher(getNDK());
    
    // Create typing indicator publisher
    const typingIndicatorPublisher = new TypingIndicatorPublisher(getNDK());

    // Create conversation router
    const conversationRouter = new ConversationRouter(
      conversationManager,
      routingLLM,
      conversationPublisher,
      llmService,
      typingIndicatorPublisher
    );

    logInfo("System components initialized with conversation routing support");

    return {
      conversationManager,
      llmService,
      routingLLM,
      conversationRouter,
      conversationPublisher,
      llmSettings,
    };
  }

  private getRoutingConfig(llmSettings: TenexLLMs): string {
    try {
      return llmSettings.defaults?.routing || llmSettings.defaults?.agents || "default";
    } catch {
      return "default";
    }
  }
}