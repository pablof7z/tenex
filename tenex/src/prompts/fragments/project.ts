import { fragmentRegistry } from "../core/FragmentRegistry";
import type { PromptFragment } from "../core/types";
import { createValidator, hasProperty, isObject, validators } from "../core/validation";

interface ProjectFragmentArgs {
  project: {
    name: string;
    description?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
  detailed?: boolean;
}

const validateProjectArgs = createValidator<ProjectFragmentArgs>(
  [
    (args): args is ProjectFragmentArgs =>
      isObject(args) &&
      hasProperty(args, "project") &&
      isObject(args.project) &&
      validators.hasRequiredString("name")(args.project) &&
      validators.hasOptionalString("description")(args.project) &&
      validators.hasOptionalStringArray("tags")(args.project) &&
      validators.hasOptionalBoolean("detailed")(args),
  ],
  (args) => `Received: ${JSON.stringify(args, null, 2)}`
);

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
