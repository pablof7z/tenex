import { useAtomValue } from "jotai";
import { projectLLMConfigsAtom } from "../lib/store";

/**
 * Hook to get available LLM configurations for a project
 */
export function useProjectLLMConfigs(projectDir: string | undefined): Record<string, any> {
    const llmConfigs = useAtomValue(projectLLMConfigsAtom);

    if (!projectDir) {
        return {};
    }

    return llmConfigs.get(projectDir) || {};
}
