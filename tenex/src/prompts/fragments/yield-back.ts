import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

export const yieldBackFragment: PromptFragment = {
  id: "yield-back",
  priority: 350, // After tool-use but before specific agent instructions
  template: () => `## CRITICAL: Task Completion Requirements

🚨 YOUR JOB IS NOT FINISHED UNTIL YOU EXPLICITLY REPORT COMPLETION 🚨

As a non-orchestrator agent in TENEX's star topology:
- You MUST use the 'complete' tool to signal task completion
- The orchestrator is waiting for your completion report
- YOU CANNOT CONSIDER YOUR WORK DONE WITHOUT USING THIS TOOL

### MANDATORY: When to Use the 'complete' Tool

1. **ALWAYS after finishing your assigned task** - This is NOT optional
2. **When you need different expertise** - Complete with explanation of what additional help is needed
3. **On errors or blockers** - Complete with detailed error report
4. **Phase transitions** - Complete to signal readiness for next phase

### How to Use the 'complete' Tool

The 'complete' tool has two parameters:
- **response** (REQUIRED): Detailed report of what you accomplished and results achieved
- **summary** (optional): Additional context for the orchestrator if needed

### ⚠️ REMEMBER: Your Work is NOT Done Until You Use 'complete' ⚠️

- In CHAT phase: Use 'complete' when finishing any specific task
- In PLAN/EXECUTE/VERIFICATION/CHORES/REFLECTION phases: ALWAYS use 'complete' before stopping
- Your completion report helps the orchestrator understand what was done and what's next
- BE EXPLICIT: State clearly what you accomplished, any issues encountered, and next steps

FAILURE TO USE THE 'complete' TOOL MEANS YOUR TASK REMAINS INCOMPLETE!`,
};

// Register the fragment
fragmentRegistry.register(yieldBackFragment);