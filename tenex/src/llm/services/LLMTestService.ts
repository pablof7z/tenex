import { MultiLLMService } from "../MultiLLMService";
import type { CompletionRequest, LLMConfig } from "../types";
import type { TenexLLMs } from "@/services/config/types";
import { logger } from "@/utils/logger";
import chalk from "chalk";

/**
 * Service responsible for testing LLM configurations
 */
export class LLMTestService {
  /**
   * Test an LLM configuration to ensure it's working
   */
  async testConfiguration(
    config: LLMConfig,
    llmsConfig: TenexLLMs,
    configName?: string
  ): Promise<boolean> {
    try {
      // Validate config before testing
      if (!config.provider) {
        logger.error(chalk.red("\n❌ Test failed: Provider is required"));
        return false;
      }

      if (!config.model) {
        logger.error(chalk.red("\n❌ Test failed: Model is required"));
        return false;
      }

      // Check if API key is required for this provider
      if (config.provider !== "ollama" && !llmsConfig.credentials[config.provider]?.apiKey) {
        logger.error(chalk.red(`\n❌ Test failed: API key is required for ${config.provider}`));
        return false;
      }

      const service = new MultiLLMService({
        provider: config.provider,
        model: config.model,
        apiKey: llmsConfig.credentials[config.provider]?.apiKey,
        baseUrl: llmsConfig.credentials[config.provider]?.baseUrl,
      });

      const request: CompletionRequest = {
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Respond with exactly: 'Configuration test successful!'",
          },
          {
            role: "user",
            content: "Please confirm this configuration works.",
          },
        ],
      };

      const response = await service.complete(request);

      if (response?.content) {
        logger.info(chalk.green(`\n✅ Test successful! Response: ${response.content}`));
        return true;
      }

      logger.error(chalk.red("\n❌ Test failed: No response received"));
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(chalk.red(`\n❌ Test failed: ${errorMessage}`));

      // Provide more specific guidance based on error
      if (errorMessage.includes("apiKey") || errorMessage.includes("API key")) {
        logger.info(chalk.yellow("💡 Make sure you've entered a valid API key"));
      } else if (errorMessage.includes("model")) {
        logger.info(chalk.yellow("💡 The selected model might not be available"));
      } else if (errorMessage.includes("network") || errorMessage.includes("connect")) {
        logger.info(chalk.yellow("💡 Check your internet connection"));
      }

      return false;
    }
  }
}

// Export singleton instance
export const llmTestService = new LLMTestService();