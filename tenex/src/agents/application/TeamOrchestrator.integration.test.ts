import { describe, it, expect, vi } from "vitest";
import { TeamOrchestrator } from "./TeamOrchestrator";
import { OpenRouterProvider } from "../../llm/OpenRouterProvider";
import type { TeamFormationRequest, AgentConfig, LLMProvider } from "../core/types";
import { logger } from "@tenex/shared/logger";
import type { LLMProvider as ActualLLMProvider } from "../../llm/types";
import { NDKEvent, type NDKProject } from "@nostr-dev-kit/ndk";

const testLogger = logger.forModule("integration-test");

// Adapter to convert between the two LLMProvider interfaces
class LLMProviderAdapter implements LLMProvider {
    constructor(private actualProvider: ActualLLMProvider) {}

    async complete(request: {
        messages: Array<{ role: string; content: string }>;
        maxTokens?: number;
        temperature?: number;
        context?: any;
    }): Promise<{ content: string; usage?: any }> {
        const response = await this.actualProvider.generateResponse(
            request.messages,
            {
                provider: "openrouter",
                model: "google/gemini-2.5-flash-preview",
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                enableCaching: false,
                apiKey: "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"
            },
            request.context
        );

        return {
            content: response.content,
            usage: response.usage
        };
    }
}

describe("TeamOrchestrator Integration Tests", () => {
    it("should handle malformed JSON responses gracefully with real LLM", async () => {
        // Skip if no API key is available
        const apiKey = "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";
        if (!apiKey) {
            console.log("Skipping integration test - no OpenRouter API key found");
            return;
        }

        // Create a real LLM provider
        const openRouterProvider = new OpenRouterProvider();
        const llm = new LLMProviderAdapter(openRouterProvider);

        // Create TeamOrchestrator with real LLM
        const orchestrator = new TeamOrchestrator(llm, {
            publish: async () => ({ success: true })
        });

        // Create test agents
        const availableAgents = new Map<string, AgentConfig>([
            ["coder", {
                name: "coder",
                role: "Software Developer",
                instructions: "Writes and implements code features",
                nsec: "test-nsec-coder"
            }],
            ["debugger", {
                name: "debugger",
                role: "Bug Investigation Specialist",
                instructions: "Investigates and fixes bugs, analyzes errors, and troubleshoots issues",
                nsec: "test-nsec-debugger"
            }],
            ["planner", {
                name: "planner",
                role: "Architecture and Planning Expert",
                instructions: "Designs system architecture and plans implementation strategies",
                nsec: "test-nsec-planner"
            }]
        ]);

        // Create a request that might trigger complex JSON responses
        const event = new NDKEvent();
        event.id = "test-event-1";
        event.content = "The textarea in the chat interface is limited to 50px height and won't expand. This is a UI bug that needs investigation and fixing.";
        event.created_at = Math.floor(Date.now() / 1000);
        event.pubkey = "test-pubkey";
        event.kind = 1111;
        event.tags = [];
        event.sig = "test-sig";
        
        const request: TeamFormationRequest = {
            event,
            availableAgents,
            projectEvent: {
                id: "test-project-id",
                dTag: "test-project",
                title: "TENEX Project",
                description: "A multi-agent development platform",
                repo: "https://github.com/test/tenex",
                content: "A multi-agent development platform"
            } as unknown as NDKProject
        };

        try {
            const result = await orchestrator.formTeam(request);
            
            // Verify the result structure
            expect(result).toBeDefined();
            expect(result.team).toBeDefined();
            expect(result.team.lead).toBeDefined();
            expect(result.team.members).toBeInstanceOf(Array);
            expect(result.conversationPlan).toBeDefined();
            expect(result.conversationPlan.stages).toBeInstanceOf(Array);
            
            // Verify the team lead is a valid agent
            expect(availableAgents.has(result.team.lead)).toBe(true);
            
            // Verify all team members are valid agents
            for (const member of result.team.members) {
                expect(availableAgents.has(member)).toBe(true);
            }
            
            // Log success
            testLogger.info("Integration test passed - team formation completed successfully");
            testLogger.info(`Team lead: ${result.team.lead}`);
            testLogger.info(`Team members: ${result.team.members.join(", ")}`);
            testLogger.info(`Reasoning: ${result.reasoning}`);
            
        } catch (error) {
            // The test should not fail - the error handling should work
            testLogger.error("Integration test failed:", error);
            throw error;
        }
    }, 30000); // 30 second timeout for LLM calls

    it("should successfully retry on malformed JSON", async () => {
        // Mock LLM that returns malformed JSON on first attempt
        const mockLLM = {
            complete: vi.fn()
                .mockResolvedValueOnce({
                    content: `\`\`\`json
{
  "team": {
    "lead": "debugger",
    "members": ["debugger"]
  ",
  "conversationPlan": {
    "stages": [{
      "participants": ["debugger"],
      "purpose": "Debug the issue",
      "expectedOutcome": "Fixed bug",
      "transitionCriteria": "Bug is resolved",
      "primarySpeaker": "debugger"
    }],
    "estimatedComplexity": 3
  },
  "reasoning": "Simple debugging task"
}
\`\`\``
                })
                .mockResolvedValueOnce({
                    content: `\`\`\`json
{
  "team": {
    "lead": "debugger",
    "members": ["debugger"]
  },
  "conversationPlan": {
    "stages": [{
      "participants": ["debugger"],
      "purpose": "Debug the issue",
      "expectedOutcome": "Fixed bug",
      "transitionCriteria": "Bug is resolved",
      "primarySpeaker": "debugger"
    }],
    "estimatedComplexity": 3
  },
  "reasoning": "Simple debugging task"
}
\`\`\``
                })
        };

        const orchestrator = new TeamOrchestrator(mockLLM as any, {
            publish: async () => ({ success: true })
        });

        const availableAgents = new Map<string, AgentConfig>([
            ["debugger", {
                name: "debugger",
                role: "Debugger",
                instructions: "Debug issues",
                nsec: "test-nsec"
            }]
        ]);

        const request: TeamFormationRequest = {
            event: {
                id: "test-event",
                content: "Fix a bug",
                created_at: Date.now(),
                pubkey: "test-pubkey",
                kind: 1111,
                tags: [],
                sig: "test-sig"
            },
            availableAgents,
            projectEvent: {
                id: "test-project-id",
                dTag: "test-project",
                title: "Test Project",
                description: undefined,
                repo: undefined,
                content: ""
            } as unknown as NDKProject
        };

        const result = await orchestrator.formTeam(request);
        
        // Should succeed on second attempt
        expect(result.team.lead).toBe("debugger");
        
        // The mock should be called twice because JSON repair fixes it but validation still fails
        // (conversationPlan is under team due to the malformed JSON structure)
        expect(mockLLM.complete).toHaveBeenCalledTimes(2);
        
        // Verify the retry guidance was added on the second call
        const secondCall = mockLLM.complete.mock.calls[1][0];
        expect(secondCall.messages[1].content).toContain("IMPORTANT: Your previous response had formatting issues");
    });

    it("should handle real world edge case with nested JSON repair", async () => {
        const malformedResponse = `Here's the team formation:

\`\`\`json
{
  "team": {
    "lead": "coder",
    "members": ["coder", "debugger"]
  },
  "conversationPlan": {
    "stages": [
      {
        "participants": ["coder"],
        "purpose": "Investigate the textarea height limitation issue in the chat interface",
        "expectedOutcome": "Identify the CSS or JavaScript causing the 50px height restriction",
        "transitionCriteria": "Root cause of the height limitation is found",
        "primarySpeaker": "coder"
      },
      {
        "participants": ["coder", "debugger"],
        "purpose": "Fix the identified issue and ensure textarea expands properly
      }
    ],
    "estimatedComplexity": 4
  },
  "reasoning": "This is a straightforward UI bug that requires investigation and fixing. The coder will first investigate to find the root cause, then collaborate with the debugger if needed for complex interactions."
}
\`\`\``;

        const mockLLM = {
            complete: vi.fn().mockResolvedValueOnce({ content: malformedResponse })
        };

        const orchestrator = new TeamOrchestrator(mockLLM as any, {
            publish: async () => ({ success: true })
        });

        const availableAgents = new Map<string, AgentConfig>([
            ["coder", {
                name: "coder",
                role: "Developer",
                instructions: "Writes code",
                nsec: "test-nsec-coder"
            }],
            ["debugger", {
                name: "debugger",
                role: "Debugger",
                instructions: "Debug issues",
                nsec: "test-nsec-debugger"
            }]
        ]);

        const event3 = new NDKEvent();
        event3.id = "test-event";
        event3.content = "Fix textarea height issue";
        event3.created_at = Math.floor(Date.now() / 1000);
        event3.pubkey = "test-pubkey";
        event3.kind = 1111;
        event3.tags = [];
        event3.sig = "test-sig";
        
        const request: TeamFormationRequest = {
            event: event3,
            availableAgents,
            projectEvent: {
                id: "test-project-id",
                dTag: "test-project",
                title: "Test Project",
                description: undefined,
                repo: undefined,
                content: ""
            } as unknown as NDKProject
        };

        const result = await orchestrator.formTeam(request);
        
        // Should successfully parse and repair the JSON
        expect(result.team.lead).toBe("coder");
        expect(result.team.members).toContain("coder");
        expect(result.team.members).toContain("debugger");
        expect(result.conversationPlan.stages).toHaveLength(2);
    });
});