export interface PromptFragment<T = any> {
  id: string;
  priority?: number;
  template: (args: T) => string;
}

export interface FragmentConfig {
  fragmentId: string;
  args: any;
  condition?: (args: any) => boolean;
}
