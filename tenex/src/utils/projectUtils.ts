import { getNDK } from "@/nostr/ndkClient";
import { NDKProject } from "@nostr-dev-kit/ndk";
import { configurationService } from "@tenex/shared/services";
import type { TenexConfiguration } from "@tenex/types/config";
import { logger } from "@tenex/shared";

/**
 * Shared utilities for project configuration and event handling
 * Eliminates duplication between ProjectManager and ProjectLoader
 */
export class ProjectConfigurationService {
  /**
   * Load project configuration with proper error handling
   */
  static async loadConfiguration(projectPath: string): Promise<TenexConfiguration> {
    try {
      const configuration = await configurationService.loadConfiguration(projectPath);
      logger.debug("Loaded project configuration", { projectPath });
      return configuration;
    } catch (error) {
      logger.error("Failed to load project configuration", { error, projectPath });
      throw new Error(`Failed to load project configuration from ${projectPath}: ${error}`);
    }
  }

  /**
   * Fetch project event from Nostr with consistent error handling
   */
  static async fetchProjectEvent(naddr: string): Promise<NDKProject> {
    try {
      const ndk = getNDK();
      const event = await ndk.fetchEvent(naddr);
      
      if (!event) {
        throw new Error(`Project not found for naddr: ${naddr}`);
      }
      
      const project = NDKProject.from(event);
      logger.debug("Fetched project event", { naddr, id: project.id });
      return project;
    } catch (error) {
      logger.error("Failed to fetch project event", { error, naddr });
      throw new Error(`Failed to fetch project from ${naddr}: ${error}`);
    }
  }
}