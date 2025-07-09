import { PromptBuilder } from "../../core/PromptBuilder";
import "../orchestrator-routing"; // Ensure fragments are registered

describe("Orchestrator Routing Fragments", () => {
    it("should generate orchestrator routing instructions", () => {
        const prompt = new PromptBuilder().add("orchestrator-routing-instructions", {}).build();

        expect(prompt).toContain("## Orchestrator Agent Routing Instructions");
        expect(prompt).toContain("Core Routing Principles");
        expect(prompt).toContain("Message Passing Rules");
        expect(prompt).toContain("Request Assessment");
        expect(prompt).toContain("Quality Control in Plan Phase");
        expect(prompt).toContain("Quality Control in Execute Phase");
        expect(prompt).toContain("Required Phase Sequence After Execution");
    });
});
