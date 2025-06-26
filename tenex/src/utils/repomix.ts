import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { logger } from "@/utils/logger";

export interface RepomixResult {
  content: string;
  size: number;
  lines: number;
  cleanup: () => void;
}

/**
 * Generate repository content using repomix
 */
export async function generateRepomixOutput(projectPath: string): Promise<RepomixResult> {
  const outputPath = join(tmpdir(), `repomix-${randomUUID()}.xml`);
  
  try {
    logger.debug("Running repomix", { outputPath, projectPath });
    execSync(`npx repomix --output "${outputPath}" --style xml`, {
      cwd: projectPath,
      stdio: "pipe",
    });

    const content = readFileSync(outputPath, "utf-8");
    const lines = content.split("\n").length;
    
    logger.debug("Repomix output generated", { 
      size: content.length,
      lines 
    });

    return {
      content,
      size: content.length,
      lines,
      cleanup: () => {
        try {
          unlinkSync(outputPath);
        } catch (e) {
          logger.warn("Failed to clean up temporary file", { outputPath, error: e });
        }
      }
    };
  } catch (error) {
    // Clean up on error
    try {
      unlinkSync(outputPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}