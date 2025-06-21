import type { AgentSummary } from "@/types/routing";
import { PromptBuilder } from "../core/PromptBuilder";

export interface RoutingPromptArgs {
  message?: string;
  currentPhase?: string;
  phaseHistory?: string;
  agents?: AgentSummary[];
  conversationSummary?: string;
  projectContext?: string;
  projectInventory?: string;
}

export function buildNewConversationRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  let promptBuilder = builder
    .add("base-context", {
      content: "You are a routing system for a development assistant platform.",
    })
    .add("task-description", {
      content:
        "Analyze this user message and determine the appropriate phase and initial approach.",
    });

  if (args.projectContext || args.projectInventory) {
    const enrichedContext = formatEnrichedProjectContext(args.projectContext, args.projectInventory);
    promptBuilder = promptBuilder.add("base-context", {
      content: enrichedContext,
    });
  }

  return promptBuilder
    .add("phase-descriptions", {})
    .add("agent-list", {
      agents: args.agents || [],
      format: "simple",
    })
    .add("user-context", {
      content: `User message: "${args.message}"`,
    })
    .add("json-response", {
      schema: `{
  "phase": "chat|plan|execute|review",
  "reasoning": "brief explanation of why this phase",
  "confidence": 0.0-1.0
}`,
    })
    .build();
}

export function buildPhaseTransitionRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "You are evaluating whether a conversation should transition to a new phase.",
    })
    .add("current-state", {
      content: `Current phase: ${args.currentPhase}
Conversation summary: ${args.conversationSummary}`,
    })
    .add("history", {
      content: `Recent activity:\n${args.phaseHistory}`,
    })
    .add("completion-criteria", {
      content: `Completion criteria:
- chat: Requirements are clear and documented
- plan: Architecture approved by relevant experts
- execute: Implementation complete and working
- review: Quality criteria met, tests passing`,
    })
    .add("task-description", {
      content: "Should we transition to a new phase?",
    })
    .add("json-response", {
      schema: `{
  "shouldTransition": true|false,
  "targetPhase": "chat|plan|execute|review",
  "reasoning": "brief explanation"
}`,
    })
    .build();
}

export function buildSelectAgentRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  let promptBuilder = builder.add("base-context", {
    content: "Select the most appropriate agent for the current task.",
  });

  if (args.projectContext || args.projectInventory) {
    const enrichedContext = formatEnrichedProjectContext(args.projectContext, args.projectInventory);
    promptBuilder = promptBuilder.add("base-context", {
      content: enrichedContext,
    });
  }

  return promptBuilder
    .add("current-state", {
      content: `Current phase: ${args.currentPhase}
Task context: ${args.message}`,
    })
    .add("agent-list", {
      agents: args.agents || [],
      format: "detailed",
    })
    .add("task-description", {
      content:
        "Select the agent best suited for this task based on their expertise. Consider the project structure and file types when choosing agents.",
    })
    .add("json-response", {
      schema: `{
  "agentPubkey": "selected agent's pubkey",
  "reasoning": "why this agent is best suited"
}`,
    })
    .build();
}

export function buildFallbackRoutingPrompt(args: RoutingPromptArgs): string {
  const builder = new PromptBuilder();

  return builder
    .add("base-context", {
      content: "The primary routing failed. Analyze the conversation and determine next steps.",
    })
    .add("error-context", {
      content: `Message: ${args.message}
Current phase: ${args.currentPhase || "unknown"}`,
    })
    .add("task-description", {
      content: `Determine the appropriate action:
1. Which phase should handle this?
2. Should we ask the user for clarification?
3. Should we hand off to a specific agent?`,
    })
    .add("json-response", {
      schema: `{
  "action": "set_phase|ask_user|handoff",
  "phase": "chat|plan|execute|review" (if action is set_phase),
  "message": "message to user" (if action is ask_user),
  "agentPubkey": "agent pubkey" (if action is handoff),
  "reasoning": "explanation"
}`,
    })
    .build();
}

function formatEnrichedProjectContext(
  basicContext?: string,
  inventory?: ProjectInventory
): string {
  const sections: string[] = [];

  sections.push("## Project Context\n");

  if (inventory) {
    // Add rich project overview from inventory
    sections.push(`**Project Description:** ${inventory.projectDescription}`);
    sections.push(`**Technologies:** ${inventory.technologies.join(", ")}`);
    sections.push(`**Total Files:** ${inventory.stats.totalFiles}`);
    sections.push(`**Total Directories:** ${inventory.stats.totalDirectories}\n`);

    // Add top file types for better agent selection
    sections.push("### Primary File Types:");
    const topFileTypes = Object.entries(inventory.stats.fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [type, count] of topFileTypes) {
      sections.push(`- ${type}: ${count} files`);
    }
    sections.push("");

    // Add key directories that might influence routing
    const keyDirs = inventory.directories
      .filter(dir => {
        const dirName = dir.path.toLowerCase();
        return dirName.includes("src") || dirName.includes("lib") || 
               dirName.includes("components") || dirName.includes("services") ||
               dirName.includes("api") || dirName.includes("test");
      })
      .slice(0, 10);
    
    if (keyDirs.length > 0) {
      sections.push("### Key Directories:");
      for (const dir of keyDirs) {
        sections.push(`- **${dir.path}/** - ${dir.fileCount} files`);
      }
      sections.push("");
    }

    // Add files with specific tags that might be relevant
    const taggedFiles = inventory.files
      .filter(file => file.tags && file.tags.length > 0)
      .slice(0, 20);
    
    if (taggedFiles.length > 0) {
      sections.push("### Notable Files:");
      const filesByTag: Record<string, string[]> = {};
      
      for (const file of taggedFiles) {
        for (const tag of file.tags || []) {
          if (!filesByTag[tag]) filesByTag[tag] = [];
          filesByTag[tag].push(file.path);
        }
      }
      
      for (const [tag, files] of Object.entries(filesByTag)) {
        sections.push(`\n**${tag}:**`);
        for (const file of files.slice(0, 5)) {
          sections.push(`  - ${file}`);
        }
      }
      sections.push("");
    }
  }

  // Add basic context if no inventory
  if (!inventory && basicContext) {
    sections.push(basicContext);
  }

  return sections.join("\n");
}

export const RoutingPromptBuilder = {
  newConversation: buildNewConversationRoutingPrompt,
  phaseTransition: buildPhaseTransitionRoutingPrompt,
  selectAgent: buildSelectAgentRoutingPrompt,
  fallbackRouting: buildFallbackRoutingPrompt,
};
