/**
 * Common test fixtures for agent testing
 */

export const fixtures = {
    /**
     * Sample project paths
     */
    projectPaths: {
        simple: "/test/projects/simple-app",
        complex: "/test/projects/complex-system",
        withSpaces: "/test/projects/my app with spaces",
    },

    /**
     * Sample agent names
     */
    agentNames: {
        default: "default",
        code: "code",
        planner: "planner",
        debug: "debug",
        custom: "custom-agent",
    },

    /**
     * Sample LLM responses
     */
    llmResponses: {
        simple: "I understand your request. Let me help you with that.",
        withCode: `I'll help you implement that feature. Here's the code:

\`\`\`typescript
export function calculateSum(a: number, b: number): number {
  return a + b;
}
\`\`\`

This function takes two numbers and returns their sum.`,
        withTool: "Let me check the file system for you.",
        error: "I encountered an error while processing your request.",
    },

    /**
     * Sample tool responses
     */
    toolResponses: {
        fileRead: {
            success: true,
            content: 'console.log("Hello, world!");',
        },
        fileWrite: {
            success: true,
            path: "/test/file.ts",
        },
        bash: {
            success: true,
            output: "Command executed successfully",
            exitCode: 0,
        },
    },

    /**
     * Sample prompts
     */
    prompts: {
        simple: "Hello, can you help me?",
        code: "Write a function to calculate fibonacci numbers",
        task: "Create a REST API with authentication",
        debug: "Fix the error in my code",
    },

    /**
     * Sample metadata
     */
    metadata: {
        llm: {
            model: "claude-3-opus-20240229",
            provider: "anthropic",
            temperature: 0.7,
            maxTokens: 4096,
        },
        usage: {
            promptTokens: 150,
            completionTokens: 250,
            totalTokens: 400,
            cost: 0.012,
        },
        timing: {
            start: 1704067200000,
            end: 1704067205000,
            duration: 5000,
        },
    },
};
