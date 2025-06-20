import { fragmentRegistry } from "./FragmentRegistry";
import type { FragmentConfig, PromptFragment } from "./types";

export class PromptBuilder {
  private fragments: FragmentConfig[] = [];

  add<T>(fragmentId: string, args: T, condition?: (args: T) => boolean): this {
    if (!fragmentRegistry.has(fragmentId)) {
      throw new Error(
        `Fragment "${fragmentId}" not found in registry. Available fragments: ${fragmentRegistry.getAllIds().join(", ")}`
      );
    }
    this.fragments.push({ fragmentId, args, condition });
    return this;
  }

  addFragment<T>(fragment: PromptFragment<T>, args: T, condition?: (args: T) => boolean): this {
    fragmentRegistry.register(fragment);
    this.fragments.push({
      fragmentId: fragment.id,
      args,
      condition,
    });
    return this;
  }

  build(): string {
    const fragmentsWithPriority = this.fragments
      .filter((config) => !config.condition || config.condition(config.args))
      .map((config) => {
        const fragment = fragmentRegistry.get(config.fragmentId);
        if (!fragment) {
          throw new Error(`Fragment ${config.fragmentId} not found`);
        }
        return {
          priority: fragment.priority || 50,
          content: fragment.template(config.args),
        };
      })
      .sort((a, b) => a.priority - b.priority);

    return fragmentsWithPriority
      .map((f) => f.content)
      .filter((content) => content.trim().length > 0)
      .join("\n\n");
  }

  clear(): this {
    this.fragments = [];
    return this;
  }

  getFragmentCount(): number {
    return this.fragments.length;
  }
}
