import { logger } from "@tenex/shared";
import type { ToolInvocation, ToolPattern } from "./types";

export class ToolDetector {
  private patterns: ToolPattern[] = [
    // Shell command pattern: <execute>command</execute>
    {
      pattern: /<execute>(.*?)<\/execute>/gs,
      parser: (match) => ({
        toolName: 'shell',
        action: 'execute',
        parameters: { command: match[1].trim() },
        rawMatch: match[0]
      })
    },
    
    // File read pattern: <read>filepath</read>
    {
      pattern: /<read>(.*?)<\/read>/gs,
      parser: (match) => ({
        toolName: 'file',
        action: 'read',
        parameters: { path: match[1].trim() },
        rawMatch: match[0]
      })
    },
    
    // File write pattern: <write file="path">content</write>
    {
      pattern: /<write\s+file="([^"]+)">(.*?)<\/write>/gs,
      parser: (match) => ({
        toolName: 'file',
        action: 'write',
        parameters: { 
          path: match[1].trim(),
          content: match[2]
        },
        rawMatch: match[0]
      })
    },
    
    // File edit pattern: <edit file="path" from="old" to="new"/>
    {
      pattern: /<edit\s+file="([^"]+)"\s+from="([^"]*)"\s+to="([^"]*)"\/>/gs,
      parser: (match) => ({
        toolName: 'file',
        action: 'edit',
        parameters: {
          path: match[1].trim(),
          oldContent: match[2],
          newContent: match[3]
        },
        rawMatch: match[0]
      })
    },
    
    // Web search pattern: <search>query</search>
    {
      pattern: /<search>(.*?)<\/search>/gs,
      parser: (match) => ({
        toolName: 'web',
        action: 'search',
        parameters: { query: match[1].trim() },
        rawMatch: match[0]
      })
    },
    
    // API call pattern: <api method="GET|POST" url="...">body</api>
    {
      pattern: /<api\s+method="(GET|POST|PUT|DELETE)"\s+url="([^"]+)">(.*?)<\/api>/gs,
      parser: (match) => ({
        toolName: 'api',
        action: 'call',
        parameters: {
          method: match[1],
          url: match[2],
          body: match[3].trim() || undefined
        },
        rawMatch: match[0]
      })
    }
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
            logger.debug('Tool invocation detected', {
              tool: invocation.toolName,
              action: invocation.action
            });
          }
        } catch (error) {
          logger.error('Failed to parse tool invocation', { 
            match: match[0], 
            error 
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
    const sortedInvocations = [...invocations].sort((a, b) => 
      response.indexOf(b.rawMatch) - response.indexOf(a.rawMatch)
    );
    
    for (const invocation of sortedInvocations) {
      cleaned = cleaned.replace(invocation.rawMatch, '');
    }
    
    // Clean up extra whitespace
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Add a custom pattern for tool detection
   */
  addPattern(pattern: ToolPattern): void {
    this.patterns.push(pattern);
  }
}