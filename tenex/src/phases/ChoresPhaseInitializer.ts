import type { Conversation } from "@/conversations/types";
import { getNDK } from "@/nostr/ndkClient";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { projectContext } from "@/services";
import { updateInventory } from "@/utils/inventory";
import type { Agent } from "@/agents/types";
import type { Phase } from "@/conversations/types";
import { logger } from "@/utils/logger";
import type { PhaseInitializationResult, PhaseInitializer } from "./types";
import { handlePhaseError } from "./utils";

/**
 * Chores Phase Initializer
 *
 * The chores phase handles maintenance tasks after the review phase,
 * including updating the project inventory with changes made during
 * the conversation.
 */
export class ChoresPhaseInitializer implements PhaseInitializer {
  phase: Phase = "chores";

  async initialize(
    conversation: Conversation,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    logger.info("[CHORES Phase] Initializing chores phase", {
      conversationId: conversation.id,
      title: conversation.title,
    });

    try {
      const project = projectContext.getCurrentProject();
      const projectNsec = projectContext.getCurrentProjectNsec();
      const signer = new NDKPrivateKeySigner(projectNsec);
      const ndk = getNDK();

      // Get the list of changed files from the conversation metadata
      const changedFiles = this.extractChangedFiles(conversation);

      if (changedFiles.length === 0) {
        logger.info("[CHORES Phase] No file changes detected, skipping inventory update");
        return {
          success: true,
          message: "Chores phase complete. No inventory update needed.",
          metadata: {
            phase: "chores",
            inventoryUpdated: false,
            reason: "No file changes detected",
          },
        };
      }

      logger.info("[CHORES Phase] Running inventory update with Claude Code", {
        changedFilesCount: changedFiles.length,
        files: changedFiles.slice(0, 10), // Log first 10 files
      });

      try {
        await updateInventory(process.cwd(), changedFiles);

        logger.info("[CHORES Phase] Inventory update started with Claude Code");

        return {
          success: true,
          message: `Chores phase complete. Started inventory update for ${changedFiles.length} changed files.`,
          metadata: {
            phase: "chores",
            inventoryUpdateStarted: true,
            filesUpdated: changedFiles.length,
          },
        };
      } catch (error) {
        logger.error("[CHORES Phase] Failed to start inventory update", { error });

        // Don't fail the phase if inventory update fails
        return {
          success: true,
          message: "Chores phase complete. Inventory update failed but continuing.",
          metadata: {
            phase: "chores",
            inventoryUpdateStarted: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    } catch (error) {
      return handlePhaseError("Chores", error);
    }
  }

  /**
   * Extract the list of changed files from the conversation
   */
  private extractChangedFiles(conversation: Conversation): string[] {
    const changedFiles = new Set<string>();

    // Check for files mentioned in execute phase metadata
    if (conversation.metadata.execute_files) {
      const executeFiles = conversation.metadata.execute_files;
      if (Array.isArray(executeFiles)) {
        for (const file of executeFiles) {
          changedFiles.add(file);
        }
      }
    }

    // Parse conversation history for file mentions
    // Look for patterns like "created file X", "modified file Y", etc.
    for (const event of conversation.history) {
      if (event.content) {
        const fileMatches = this.extractFilePathsFromContent(event.content);
        for (const file of fileMatches) {
          changedFiles.add(file);
        }
      }
    }

    // Check git status if available
    if (conversation.metadata.gitBranch) {
      // TODO: Could run git diff to get actual changed files
      // For now, rely on conversation parsing
    }

    return Array.from(changedFiles);
  }

  /**
   * Extract file paths from content using various patterns
   */
  private extractFilePathsFromContent(content: string): string[] {
    const files: string[] = [];

    // Common patterns for file mentions
    const patterns = [
      /(?:created|modified|updated|wrote|edited)\s+(?:file\s+)?[`"]?([^\s`"]+\.[a-zA-Z]+)[`"]?/gi,
      /(?:File|file):\s*[`"]?([^\s`"]+\.[a-zA-Z]+)[`"]?/g,
      /```[a-zA-Z]*\n\/\/\s*([^\n]+\.[a-zA-Z]+)/g, // Code block file comments
      /^([a-zA-Z0-9/_.-]+\.[a-zA-Z]+)$/gm, // Standalone file paths
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while (true) {
        match = pattern.exec(content);
        if (match === null) break;

        const filePath = match[1];
        // Filter out obvious non-file paths
        if (filePath && !filePath.includes("http") && !filePath.includes("@")) {
          files.push(filePath);
        }
      }
    }

    return files;
  }
}
