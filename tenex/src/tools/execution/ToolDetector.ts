import { logger } from "@/utils/logger";
import type { ToolInvocation, ToolPattern } from "@/tools/types";

export class ToolDetector {
  private patterns: ToolPattern[] = [
    // Shell command pattern: <execute>command</execute>
    {
      pattern: /<execute>(.*?)<\/execute>/gs,
      parser: (match: RegExpMatchArray) => ({
        toolName: "shell",
        action: "execute",
        parameters: { command: match[1]?.trim() || "" },
        rawMatch: match[0],
      }),
    },

    // File read pattern: <read>filepath</read>
    {
      pattern: /<read>(.*?)<\/read>/gs,
      parser: (match: RegExpMatchArray) => ({
        toolName: "file",
        action: "read",
        parameters: { path: match[1]?.trim() || "" },
        rawMatch: match[0],
      }),
    },

    // File write pattern: <write file="path">content</write>
    {
      pattern: /<write\s+file="([^"]+)">(.*?)<\/write>/gs,
      parser: (match: RegExpMatchArray) => ({
        toolName: "file",
        action: "write",
        parameters: {
          path: match[1]?.trim() || "",
          content: match[2] || "",
        },
        rawMatch: match[0],
      }),
    },

    // File edit pattern: <edit file="path" from="old" to="new"/>
    {
      pattern: /<edit\s+file="([^"]+)"\s+from="([^"]*)"\s+to="([^"]*)"\/>/gs,
      parser: (match: RegExpMatchArray) => ({
        toolName: "file",
        action: "edit",
        parameters: {
          path: match[1]?.trim() || "",
          oldContent: match[2] || "",
          newContent: match[3] || "",
        },
        rawMatch: match[0],
      }),
    },

    // Claude Code pattern: <claude_code mode="run|plan">prompt</claude_code>
    {
      pattern: /<claude_code(?:\s+mode="(run|plan)")?>([^<]*)<\/claude_code>/gs,
      parser: (match: RegExpMatchArray) => ({
        toolName: "claude_code",
        action: "execute",
        parameters: {
          mode: match[1] || "run",
          prompt: match[2]?.trim() || "",
        },
        rawMatch: match[0],
      }),
    },

    // Phase transition pattern: <phase_transition>phase_name</phase_transition>
    {
      pattern: /<phase_transition>(plan|execute|review)<\/phase_transition>/gs,
      parser: (match: RegExpMatchArray) => ({
        toolName: "phase_transition",
        action: "transition",
        parameters: { phase: match[1]?.trim() || "" },
        rawMatch: match[0],
      }),
    },

    // Empty phase transition pattern (for better error handling)
    {
      pattern: /<phase_transition\s*\/>/gs,
      parser: (match: RegExpMatchArray) => {
        logger.warn("Empty phase transition tag detected. Phase must be specified: <phase_transition>plan|execute|review</phase_transition>");
        return null; // Don't create an invocation for invalid syntax
      },
    },
  ];

  /**
   * Detect tool invocations in agent response
   */
  detectTools(response: string): ToolInvocation[] {
    const invocations: ToolInvocation[] = [];

    for (const { pattern, parser } of this.patterns) {
      const matches = Array.from(response.matchAll(pattern));

      for (const match of matches) {
        try {
          const invocation = parser(match);
          if (invocation) {
            invocations.push(invocation);
            logger.debug("Tool invocation detected", {
              tool: invocation.toolName,
              action: invocation.action,
            });
          }
        } catch (error) {
          logger.error("Failed to parse tool invocation", {
            match: match[0],
            error,
          });
        }
      }
    }

    return invocations;
  }

  /**
   * Remove tool invocations from response for cleaner output
   */
  cleanResponse(response: string, invocations: ToolInvocation[]): string {
    let cleaned = response;

    // Sort by position in string (reverse) to maintain indices
    const sortedInvocations = [...invocations].sort(
      (a, b) => response.indexOf(b.rawMatch) - response.indexOf(a.rawMatch)
    );

    for (const invocation of sortedInvocations) {
      cleaned = cleaned.replace(invocation.rawMatch, "");
    }

    // Clean up extra whitespace
    return cleaned.replace(/\n{3,}/g, "\n\n").trim();
  }

  /**
   * Add a custom pattern for tool detection
   */
  addPattern(pattern: ToolPattern): void {
    this.patterns.push(pattern);
  }
}
