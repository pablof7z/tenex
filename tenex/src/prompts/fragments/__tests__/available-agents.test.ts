import { PromptBuilder } from "../../core/PromptBuilder";
import "../available-agents"; // Ensure fragment is registered
import type { Agent } from "@/agents/types";

describe("Available Agents Fragment", () => {
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
        {
            name: "Backend Developer",
            pubkey: "backend789",
            role: "Backend development and API implementation", 
            slug: "backend-dev",
            signer: {} as any,
            llmConfig: "gpt-4",
            tools: ["file", "shell", "claude_code"],
        },
    ];

    it("should generate available agents list for all agents", () => {
        const prompt = new PromptBuilder()
            .add("available-agents", {
                agents: mockAgents,
            })
            .build();

        expect(prompt).toContain("## Available Agents");
        expect(prompt).toContain("Project Manager (PM)");
        expect(prompt).toContain("Frontend Developer");
        expect(prompt).toContain("Backend Developer");
        expect(prompt).toContain("pm123");
        expect(prompt).toContain("dev456");
        expect(prompt).toContain("backend789");
    });

    it("should exclude current agent from handoff options", () => {
        const prompt = new PromptBuilder()
            .add("available-agents", {
                agents: mockAgents,
                currentAgentPubkey: "dev456",
            })
            .build();

        expect(prompt).toContain("## Available Agents");
        expect(prompt).toContain("Project Manager (PM)");
        expect(prompt).not.toContain("Frontend Developer");
        expect(prompt).toContain("Backend Developer");
        expect(prompt).toContain("pm123");
        expect(prompt).not.toContain("dev456");
        expect(prompt).toContain("backend789");
    });

    it("should handle empty agents list", () => {
        const prompt = new PromptBuilder()
            .add("available-agents", {
                agents: [],
            })
            .build();

        expect(prompt).toContain("No agents are currently available for handoffs");
    });

    it("should handle case where only current agent exists", () => {
        const prompt = new PromptBuilder()
            .add("available-agents", {
                agents: [mockAgents[0]],
                currentAgentPubkey: "pm123",
            })
            .build();

        expect(prompt).toContain("No other agents are available for handoffs");
    });
});