import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

// Fragment for specialized agents to understand their expertise boundaries
interface ExpertiseBoundariesArgs {
    agentRole: string;
    isPMAgent: boolean;
}

export const expertiseBoundariesFragment: PromptFragment<ExpertiseBoundariesArgs> = {
    id: "expertise-boundaries",
    priority: 20,
    template: ({ agentRole, isPMAgent }) => {
        // Only provide boundaries guidance for non-PM agents
        if (isPMAgent) {
            return "";
        }

        return `## Expertise Boundaries

As a specialist agent with the role "${agentRole}", you should:

1. **Stay Within Your Domain**: Focus exclusively on tasks and feedback that align with your specialized role.

2. **Defer When Appropriate**: If you encounter work that falls outside your expertise:
   - Acknowledge it's outside your domain
   - Suggest which specialist agent would be better suited
   - Avoid attempting to handle it yourself

3. **Collaborate, Don't Overreach**: When your work intersects with other domains:
   - Provide input only on aspects within your expertise
   - Highlight areas that need other specialists' attention
   - Maintain clear boundaries in your responses

4. **Quality Over Scope**: It's better to excel within your specialization than to provide mediocre guidance outside it.

Remember: Your value comes from deep expertise in your specific domain, not from attempting to cover all aspects of a task.`;
    },
    validateArgs: (args): args is ExpertiseBoundariesArgs => {
        return (
            typeof args === "object" &&
            args !== null &&
            typeof (args as ExpertiseBoundariesArgs).agentRole === "string" &&
            typeof (args as ExpertiseBoundariesArgs).isPMAgent === "boolean"
        );
    },
};

// Register the fragment
fragmentRegistry.register(expertiseBoundariesFragment);