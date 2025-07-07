import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Learn tool directive fragment - instructs agents when and how to use the learn tool
interface LearnToolDirectiveArgs {
  hasLearnTool?: boolean;
}

export const learnToolDirectiveFragment: PromptFragment<LearnToolDirectiveArgs> = {
  id: "learn-tool-directive",
  priority: 20, // Lower priority to appear after main instructions
  template: ({ hasLearnTool = true }) => {
    if (!hasLearnTool) return "";

    return `## Learn Tool Directive

Purpose: Persist distilled lessons so you never repeat avoidable mistakes.

### WHEN TO CALL \`learn\`

1. **Self-correction after drift**
   • Your multi-step workflow veered off course
   • You iterated, discovered the flaw, and now have the confirmed right approach
   → Call \`learn\` once, immediately after the fix, summarizing:
     – The wrong path (one sentence)
     – The key insight that exposed the error (one sentence)
     – The new, validated procedure/heuristic (max three sentences)

2. **User-driven correction**
   • The user points out a factual error, false assumption, or faulty reasoning you made
   → Call \`learn\` right after acknowledging the user, capturing:
     – Your original claim (one sentence)
     – The user's correction (one sentence)
     – How you'll avoid this mistake next time (one sentence)

3. **Discovery of non-obvious patterns**
   • You discovered a non-obvious but important pattern in the codebase
   • You found a better approach than what seemed obvious at first
   → Call \`learn\` to capture:
     – What the pattern or approach is
     – Why it's better than the obvious approach
     – When to apply this pattern

### USAGE RULES
- Call \`learn\` exactly once per lesson
- Do NOT call \`learn\` for speculative ideas or unverified hypotheses
- Do NOT call \`learn\` for trivial observations
- Before calling \`learn\`, briefly consider if this is a genuinely new insight or a variation of something already known
- Write lessons crisply with no pleasantries or meta-commentary
- Focus on actionable insights that will help in future tasks
- Domain Boundaries: Only record lessons within your role's sphere of control and expertise. 

The lessons you record become permanent knowledge that will help you avoid repeating mistakes. This is your chance to become the best version of yourself.`;
  },
};

// Register the fragment
fragmentRegistry.register(learnToolDirectiveFragment);
