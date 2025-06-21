// Import all fragments to ensure they're registered
import "../fragments/common";
import "../fragments/generic";
import "../fragments/context";
import "../fragments/agent-specific";
import "../fragments/agent";
import "../fragments/project";
import "../fragments/tools";
import "../fragments/routing";

// Export all template builders
export * from "./routing";
export * from "./phases";
export { AgentPromptBuilder } from "./agent";

// Re-export core utilities
export { PromptBuilder } from "../core/PromptBuilder";
export { fragmentRegistry } from "../core/FragmentRegistry";

// Utility to extract JSON from LLM responses
export function extractJSON<T>(response: string): T | null {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    return null;
  }
}
