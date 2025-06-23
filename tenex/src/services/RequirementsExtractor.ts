import { NDKEvent } from "@nostr-dev-kit/ndk";
import { isEventFromUser } from "@/nostr/utils";
import { logger } from "@/utils/logger";
import { MultiLLMService } from "@/llm";
import type { Conversation } from "@/conversations/types";

export interface ExtractedRequirements {
  functionalRequirements: string[];
  technicalRequirements: string[];
  constraints: string[];
  preferences: string[];
  summary: string;
}

/**
 * Service to extract requirements from conversation history
 * Analyzes the conversation between user and project manager to identify requirements
 */
export class RequirementsExtractor {
  private static readonly EXTRACTION_PROMPT = `You are a requirements analyst. Your task is to extract project requirements from a conversation between a user and a project manager.

IMPORTANT RULES:
1. ONLY extract what was explicitly discussed in the conversation
2. DO NOT add assumptions, suggestions, or fill in gaps
3. DO NOT include implementation details that weren't mentioned
4. If something is unclear or incomplete, leave it as stated by the user
5. Preserve the user's exact intent without interpretation

Please analyze the conversation and extract:
- Functional Requirements: What the system should do (features, behaviors)
- Technical Requirements: Specific technologies, frameworks, or technical constraints mentioned
- Constraints: Limitations, boundaries, or restrictions mentioned
- Preferences: Nice-to-haves or preferred approaches mentioned
- Summary: A brief summary of what the user wants to build

Format your response as JSON:
{
  "functionalRequirements": ["requirement 1", "requirement 2"],
  "technicalRequirements": ["requirement 1", "requirement 2"],
  "constraints": ["constraint 1", "constraint 2"],
  "preferences": ["preference 1", "preference 2"],
  "summary": "Brief summary of the project"
}

If a category has no items, use an empty array.

Conversation history:
`;

  /**
   * Extract requirements from conversation history
   */
  static async extractRequirements(conversation: Conversation, projectPath: string): Promise<ExtractedRequirements | null> {
    try {
      // Filter to only chat phase events between user and project manager
      const chatEvents = conversation.history
        .filter(event => {
          const phase = event.tags.find(tag => tag[0] === "phase")?.[1];
          return phase === "chat" || !phase; // Include events without phase tag (early messages)
        })
        .filter(event => {
          // Include user messages and project manager responses
          return isEventFromUser(event) || event.tags.some(tag => 
            tag[0] === "agent" && tag[1] === "project"
          );
        });

      if (chatEvents.length === 0) {
        logger.debug("No chat events found for requirements extraction");
        return null;
      }

      // Build conversation context
      const conversationContext = this.buildConversationContext(chatEvents);
      
      // Call LLM to extract requirements
      const prompt = this.EXTRACTION_PROMPT + conversationContext;
      
      const llmService = await MultiLLMService.createForProject(projectPath);
      const response = await llmService.complete({
        messages: [{ role: "user", content: prompt }],
        options: {
          maxTokens: 2000,
          temperature: 0.3, // Lower temperature for more consistent extraction
        }
      });

      // Parse the JSON response
      const extracted = this.parseExtractedRequirements(response.content);
      
      if (extracted) {
        logger.info("Successfully extracted requirements from conversation");
      }
      
      return extracted;
    } catch (error) {
      logger.error("Failed to extract requirements:", error);
      return null;
    }
  }

  /**
   * Build a readable conversation context from events
   */
  private static buildConversationContext(events: NDKEvent[]): string {
    return events
      .map(event => {
        const role = isEventFromUser(event) ? "User" : "Project Manager";
        const content = event.content;
        return `${role}: ${content}`;
      })
      .join("\n\n");
  }

  /**
   * Parse the LLM response to extract structured requirements
   */
  private static parseExtractedRequirements(response: string): ExtractedRequirements | null {
    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error("No JSON found in requirements extraction response");
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the structure
      if (!Array.isArray(parsed.functionalRequirements) ||
          !Array.isArray(parsed.technicalRequirements) ||
          !Array.isArray(parsed.constraints) ||
          !Array.isArray(parsed.preferences) ||
          typeof parsed.summary !== "string") {
        logger.error("Invalid requirements structure in response");
        return null;
      }

      return {
        functionalRequirements: parsed.functionalRequirements,
        technicalRequirements: parsed.technicalRequirements,
        constraints: parsed.constraints,
        preferences: parsed.preferences,
        summary: parsed.summary,
      };
    } catch (error) {
      logger.error("Failed to parse requirements JSON:", error);
      return null;
    }
  }

  /**
   * Format extracted requirements for display
   */
  static formatRequirements(requirements: ExtractedRequirements): string {
    const sections: string[] = [];

    sections.push(`**Summary:**\n${requirements.summary}`);

    if (requirements.functionalRequirements.length > 0) {
      sections.push(`**Functional Requirements:**\n${requirements.functionalRequirements.map(r => `- ${r}`).join("\n")}`);
    }

    if (requirements.technicalRequirements.length > 0) {
      sections.push(`**Technical Requirements:**\n${requirements.technicalRequirements.map(r => `- ${r}`).join("\n")}`);
    }

    if (requirements.constraints.length > 0) {
      sections.push(`**Constraints:**\n${requirements.constraints.map(r => `- ${r}`).join("\n")}`);
    }

    if (requirements.preferences.length > 0) {
      sections.push(`**Preferences:**\n${requirements.preferences.map(r => `- ${r}`).join("\n")}`);
    }

    return sections.join("\n\n");
  }
}