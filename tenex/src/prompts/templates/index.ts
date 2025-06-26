// Import all fragments to ensure they're registered
import "../fragments/agentFragments";
import "../fragments/project";
import "../fragments/phase";
import "../fragments/pm-routing";
import "../fragments/available-agents";
import "../fragments/execute-task-prompt";

// Export all template builders
// Note: agent templates are handled by fragments now

// Re-export core utilities
export { PromptBuilder } from "../core/PromptBuilder";
export { fragmentRegistry } from "../core/FragmentRegistry";

// Utility to extract JSON from LLM responses
export function extractJSON<T = unknown>(response: string): T | null {
    try {
        // Try to find JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as T;
        }
        return null;
    } catch (error) {
        return null;
    }
}