import { describe, it, expect, beforeEach } from "vitest";
import type { AgentConfig } from "../../core/types";

// Create test agents that override the buildSystemPrompt method
class TestAgent {
    teamSize = 1;
    config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
    }

    setTeamSize(size: number): void {
        this.teamSize = size;
    }

    getSystemPrompt(): string {
        // Import prompts
        const { SYSTEM_PROMPTS } = require("../../../prompts");

        // Use single-agent prompt if team size is 1
        return this.teamSize === 1
            ? SYSTEM_PROMPTS.SINGLE_AGENT(
                  this.config.name,
                  this.config.role,
                  this.config.instructions
              )
            : SYSTEM_PROMPTS.BASE_AGENT(
                  this.config.name,
                  this.config.role,
                  this.config.instructions
              );
    }
}

class TestTeamLead {
    teamSize: number;
    config: AgentConfig;
    currentStageInfo: string;

    constructor(config: AgentConfig, teamSize: number, stageInfo: string) {
        this.config = config;
        this.teamSize = teamSize;
        this.currentStageInfo = stageInfo;
    }

    getSystemPrompt(): string {
        // Import prompts
        const { SYSTEM_PROMPTS } = require("../../../prompts");

        // Use single-agent prompt for single-agent teams
        if (this.teamSize === 1) {
            let prompt = SYSTEM_PROMPTS.SINGLE_AGENT(
                this.config.name,
                this.config.role,
                this.config.instructions
            );

            // Add stage info for single agents
            prompt += `\n\nCURRENT STAGE:\n${this.currentStageInfo}`;

            return prompt;
        }

        // Multi-agent team lead prompt
        const teamInfo = `Current team: ${["TestAgent", "Agent2", "Agent3"].slice(0, this.teamSize).join(", ")}
Active speakers: TestAgent, Agent2`;

        return SYSTEM_PROMPTS.TEAM_LEAD(
            this.config.name,
            this.config.role,
            this.config.instructions,
            teamInfo,
            this.currentStageInfo
        );
    }
}

describe("Agent System Prompts", () => {
    let mockConfig: AgentConfig;

    beforeEach(() => {
        mockConfig = {
            name: "TestAgent",
            role: "Test Role",
            instructions: "Test instructions",
            nsec: "nsec1qgg9947rlpvqu76pj5ecreduf9jxhselq2nae2kghhvd5g7dgjtcxfqrxt",
        };
    });

    describe("Single Agent", () => {
        it("should use single-agent prompt when team size is 1", () => {
            const agent = new TestAgent(mockConfig);

            const prompt = agent.getSystemPrompt();

            // Should NOT contain multi-agent instructions
            expect(prompt).not.toContain("multi-agent conversation");
            expect(prompt).not.toContain(
                "Only respond when you are designated as an active speaker"
            );

            // Should contain single-agent specific text
            expect(prompt).toContain("You are TestAgent, Test Role");
            expect(prompt).toContain("Instructions: Test instructions");
            expect(prompt).toContain("You are working as a single agent");
        });

        it("should use multi-agent prompt when team size is greater than 1", () => {
            const agent = new TestAgent(mockConfig);

            agent.setTeamSize(3);
            const prompt = agent.getSystemPrompt();

            // Should contain multi-agent instructions
            expect(prompt).toContain("IMPORTANT: You are in a multi-agent conversation");
            expect(prompt).toContain("Only respond when you are designated as an active speaker");
        });
    });

    describe("Team Lead", () => {
        it("should use single-agent prompt for single-agent teams", () => {
            const stageInfo = `Current stage: Test purpose
Expected outcome: Test outcome
Transition criteria: Test criteria`;

            const teamLead = new TestTeamLead(
                mockConfig,
                1, // Single agent team
                stageInfo
            );

            const prompt = teamLead.getSystemPrompt();

            // Should NOT contain multi-agent team context
            expect(prompt).not.toContain("TEAM CONTEXT:");
            expect(prompt).not.toContain("LEADERSHIP RESPONSIBILITIES:");
            expect(prompt).not.toContain("multi-agent conversation");

            // Should contain stage info
            expect(prompt).toContain("CURRENT STAGE:");
            expect(prompt).toContain("Test purpose");
            expect(prompt).toContain("You are working as a single agent");
        });

        it("should use team lead prompt for multi-agent teams", () => {
            const stageInfo = `Current stage: Test purpose
Expected outcome: Test outcome
Transition criteria: Test criteria`;

            const teamLead = new TestTeamLead(
                mockConfig,
                3, // Multi-agent team
                stageInfo
            );

            const prompt = teamLead.getSystemPrompt();

            // Should contain multi-agent team context
            expect(prompt).toContain("TEAM CONTEXT:");
            expect(prompt).toContain("LEADERSHIP RESPONSIBILITIES:");
            expect(prompt).toContain("Current team: TestAgent, Agent2, Agent3");
        });
    });
});
