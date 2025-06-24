import { PromptBuilder } from "../../core/PromptBuilder";
import "../available-agents";
import "../pm-routing";
import type { Agent } from "@/agents/types";

describe("Agent Routing Integration", () => {
    const mockAgents: Agent[] = [
        {
            name: "Project Manager",
            pubkey: "pm123",
            role: "Project coordination and planning",
            slug: "pm",
            isPMAgent: true,
            signer: {} as any,
            llmConfig: "gpt-4",
            tools: ["next_action"],
        },
        {
            name: "Frontend Developer", 
            pubkey: "dev456",
            role: "Frontend development and UI implementation",
            slug: "frontend-dev",
            isPMAgent: false,
            signer: {} as any,
            llmConfig: "gpt-4",
            tools: ["file", "shell"],
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
        expect(prompt).toContain("Project Manager (PM)");
        expect(prompt).not.toContain("Frontend Developer");
        expect(prompt).toContain("collaboration and handoffs");
    });

    it("should build complete system prompt for PM agent with routing instructions", () => {
        const prompt = new PromptBuilder()
            .add("available-agents", {
                agents: mockAgents,
                currentAgentPubkey: "pm123",
            })
            .add("pm-routing-instructions", {})
            .add("pm-handoff-guidance", {})
            .build();

        // Should have available agents
        expect(prompt).toContain("## Available Agents");
        expect(prompt).toContain("Frontend Developer");
        expect(prompt).not.toContain("Project Manager (PM)");
        
        // Should have PM routing instructions
        expect(prompt).toContain("## PM Agent Routing Instructions");
        expect(prompt).toContain("Agent Handoffs");
        expect(prompt).toContain("Phase Transitions");
        
        // Should have handoff guidance
        expect(prompt).toContain("## Agent Selection Guidance");
        expect(prompt).toContain("Agent Capabilities Match");
    });
});