import { PromptBuilder } from "../../core/PromptBuilder";
import "../available-agents";
import "../orchestrator-routing";
import type { Agent } from "@/agents/types";

describe("Agent Routing Integration", () => {
    const mockAgents: Agent[] = [
        {
            name: "Project Manager",
            pubkey: "pm123",
            role: "Project coordination and planning",
            slug: "pm",
            isOrchestrator: true,
            signer: {} as any,
            llmConfig: "gpt-4",
            tools: ["switch_phase", "handoff"],
        },
        {
            name: "Frontend Developer",
            pubkey: "dev456",
            role: "Frontend development and UI implementation",
            slug: "frontend-dev",
            isOrchestrator: false,
            signer: {} as any,
            llmConfig: "gpt-4",
            tools: ["read_path"],
        },
    ];

    it("should build complete system prompt for regular agent", () => {
        const prompt = new PromptBuilder()
            .add("available-agents", {
                agents: mockAgents,
                currentAgentPubkey: "dev456",
            })
            .build();

        expect(prompt).toContain("## Available Agents");
        expect(prompt).toContain("**Project Manager** (Orchestrator) (pm)");
        expect(prompt).not.toContain("Frontend Developer");
        expect(prompt).toContain("As a Specialist");
    });

    it("should build complete system prompt for orchestrator agent with routing instructions", () => {
        const prompt = new PromptBuilder()
            .add("available-agents", {
                agents: mockAgents,
                currentAgentPubkey: "pm123",
            })
            .add("orchestrator-routing-instructions", {})
            .build();

        // Should have available agents
        expect(prompt).toContain("## Available Agents");
        expect(prompt).toContain("Frontend Developer");
        expect(prompt).not.toContain("Project Manager (PM)");

        // Should have orchestrator routing instructions
        expect(prompt).toContain("## Orchestrator Agent Routing Instructions");
        expect(prompt).toContain("Core Routing Principles");

        // Should have routing rules
        expect(prompt).toContain("Request Assessment");
        expect(prompt).toContain("Quality Control in Plan Phase");
    });
});
