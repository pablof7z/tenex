import type { ConversationState } from "@/conversations/types";
import { getProjectContext } from "@/runtime";
import { AnalyzeTask } from "@/tasks/analyzeTask";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import { getNDK } from "@/nostr/ndkClient";
import { logger } from "@tenex/shared";
import { BasePhaseInitializer } from "./PhaseInitializer";
import type { PhaseInitializationResult } from "./types";

/**
 * Chores Phase Initializer
 *
 * The chores phase handles maintenance tasks after the review phase,
 * including updating the project inventory with changes made during
 * the conversation.
 */
export class ChoresPhaseInitializer extends BasePhaseInitializer {
  phase: Phase = "chores";

  async initialize(
    conversation: ConversationState,
    availableAgents: Agent[]
  ): Promise<PhaseInitializationResult> {
    this.log("Initializing chores phase", {
      conversationId: conversation.id,
      title: conversation.title,
    });

    try {
      const projectContext = getProjectContext();
      const ndk = getNDK();
      const signer = projectContext.projectSigner;

      // Get the list of changed files from the conversation metadata
      const changedFiles = this.extractChangedFiles(conversation);

      if (changedFiles.length === 0) {
        this.log("No file changes detected, skipping inventory update");
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

      // Create and execute the analyze task
      const analyzeTask = new AnalyzeTask({
        projectPath: projectContext.projectPath,
        conversationId: conversation.id,
        signer,
        targetFiles: changedFiles,
        skipClaudeCode: false, // Use Claude Code for better descriptions
      });

      this.log("Running analyze task to update inventory", {
        changedFilesCount: changedFiles.length,
        files: changedFiles.slice(0, 10), // Log first 10 files
      });

      try {
        const updatedInventory = await analyzeTask.execute();

        this.log("Inventory updated successfully", {
          totalFiles: updatedInventory.stats.totalFiles,
          technologies: updatedInventory.technologies,
        });

        return {
          success: true,
          message: `Chores phase complete. Updated inventory for ${changedFiles.length} changed files.`,
          metadata: {
            phase: "chores",
            inventoryUpdated: true,
            filesUpdated: changedFiles.length,
            inventoryStats: updatedInventory.stats,
          },
        };
      } catch (error) {
        this.logError("Failed to update inventory", error);
        
        // Don't fail the phase if inventory update fails
        return {
          success: true,
          message: "Chores phase complete. Inventory update failed but continuing.",
          metadata: {
            phase: "chores",
            inventoryUpdated: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    } catch (error) {
      this.logError("Failed to initialize chores phase", error);
      return {
        success: false,
        message: `Chores phase initialization failed: ${error}`,
      };
    }
  }

  /**
   * Extract the list of changed files from the conversation
   */
  private extractChangedFiles(conversation: ConversationState): string[] {
    const changedFiles = new Set<string>();

    // Check for files mentioned in execute phase metadata
    if (conversation.metadata.execute_files) {
      const executeFiles = conversation.metadata.execute_files;
      if (Array.isArray(executeFiles)) {
        executeFiles.forEach(file => changedFiles.add(file));
      }
    }

    // Parse conversation history for file mentions
    // Look for patterns like "created file X", "modified file Y", etc.
    for (const event of conversation.history) {
      if (event.content) {
        const fileMatches = this.extractFilePathsFromContent(event.content);
        fileMatches.forEach(file => changedFiles.add(file));
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
      let match;
      while ((match = pattern.exec(content)) !== null) {
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