import { PromptBuilder } from "../../core/PromptBuilder";
import "../orchestrator-routing"; // Ensure fragments are registered

describe("Orchestrator Routing Fragments", () => {
    it("should generate orchestrator routing instructions", () => {
        const prompt = new PromptBuilder().add("orchestrator-routing-instructions", {}).build();

        expect(prompt).toContain("## Orchestrator Agent Routing Instructions");
        expect(prompt).toContain("Core Routing Principles");
        expect(prompt).toContain("The Continue Tool");
        expect(prompt).toContain("Agent Selection");
        expect(prompt).toContain("Request Assessment");
        expect(prompt).toContain("Quality Handoff Requirements");
        expect(prompt).toContain("Required Phase Sequence After Execution");
    });

    it("should generate orchestrator handoff guidance", () => {
        const prompt = new PromptBuilder().add("orchestrator-handoff-guidance", {}).build();

        expect(prompt).toContain("## Agent Selection Guidance");
        expect(prompt).toContain("Agent Capabilities Match");
        expect(prompt).toContain("Execution agents");
        expect(prompt).toContain("Verification/Expert agents");
        expect(prompt).toContain("Specialist agents");
        expect(prompt).toContain("When to Use Multi-Agent Queries");
    });

    it("should combine both orchestrator fragments", () => {
        const prompt = new PromptBuilder()
            .add("orchestrator-routing-instructions", {})
            .add("orchestrator-handoff-guidance", {})
            .build();

        expect(prompt).toContain("Orchestrator Agent Routing Instructions");
        expect(prompt).toContain("Agent Selection Guidance");
    });
});
