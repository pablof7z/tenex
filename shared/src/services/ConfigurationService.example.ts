import { configurationService } from "./ConfigurationService";

// Example usage of ConfigurationService

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

        // Load project metadata
        const metadata = await configurationService.loadProjectMetadata(projectPath);
        console.log("Project Metadata:", metadata);

        // Save updated agents configuration
        const updatedAgents = {
            default: { nsec: "nsec1...", file: "agent1.json" },
            planner: "nsec1...", // Legacy format still supported
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
