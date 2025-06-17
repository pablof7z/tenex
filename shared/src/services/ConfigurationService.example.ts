import { configurationService } from "./ConfigurationService";

// Example usage of ConfigurationService

// biome-ignore lint/correctness/noUnusedVariables: This is an example function
async function example() {
    const projectPath = "/path/to/project";

    // Load configuration files with automatic validation
    try {
        // Load agents configuration
        const agents = await configurationService.loadAgentsConfig(projectPath);
        console.log("Agents:", agents);

        // Load LLM configuration
        const llmConfig = await configurationService.loadLLMConfig(projectPath);
        console.log("LLM Config:", llmConfig);

        // Get resolved LLM config (handles string references)
        const resolvedConfig = await configurationService.getResolvedLLMConfig(
            projectPath,
            "default"
        );
        console.log("Resolved LLM Config:", resolvedConfig);

        // Load project config (includes metadata)
        const projectConfig = await configurationService.loadProjectConfig(projectPath);
        console.log("Project Config:", projectConfig);

        // Save updated agents configuration
        const updatedAgents = {
            default: { nsec: "nsec1...", file: "agent1.json" },
            planner: { nsec: "nsec1..." }, // Both formats supported
        };
        await configurationService.saveAgentsConfig(projectPath, updatedAgents);

        // Check if a config exists
        const hasLLMConfig = await configurationService.configExists(projectPath, "llms");
        console.log("Has LLM config:", hasLLMConfig);
    } catch (error) {
        console.error("Configuration error:", error);
        // Validation errors will include detailed field-level errors
    }
}

// Benefits of using ConfigurationService:
// 1. Automatic validation with detailed error messages
// 2. Caching for better performance
// 3. Type safety with TypeScript
// 4. Consistent error handling
// 5. Support for backwards compatibility
// 6. Centralized configuration logic

// Run the example if this file is executed directly
if (import.meta.main) {
    example().catch(console.error);
}
