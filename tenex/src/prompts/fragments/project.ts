import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";

interface ProjectFragmentArgs {
  project: {
    name: string;
    description?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
  detailed?: boolean;
}

const validateProjectArgs = (args: unknown): args is ProjectFragmentArgs => {
  if (!args || typeof args !== "object" || !("project" in args)) {
    return false;
  }
  const obj = args as any;
  return obj.project && typeof obj.project.name === "string";
};

export const projectFragment: PromptFragment<ProjectFragmentArgs> = {
  id: "project-context",
  priority: 20,
  template: ({ project, detailed = false }) => {
    let prompt = `---\nProject: ${project.name}`;

    if (detailed && project.description) {
      prompt += `\nDescription: ${project.description}`;
    }

    if (detailed && project.tags && project.tags.length > 0) {
      prompt += `\nTags: ${project.tags.join(", ")}`;
    }

    if (detailed && project.metadata && Object.keys(project.metadata).length > 0) {
      prompt += `\nMetadata: ${JSON.stringify(project.metadata, null, 2)}`;
    }

    return prompt;
  },
  validateArgs: validateProjectArgs,
  expectedArgs:
    "{ project: { name: string, description?: string, tags?: string[], metadata?: Record<string, any> }, detailed?: boolean }",
};

// Auto-register
fragmentRegistry.register(projectFragment);
