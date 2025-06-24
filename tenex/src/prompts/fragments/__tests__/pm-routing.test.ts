import { PromptBuilder } from "../../core/PromptBuilder";
import "../pm-routing"; // Ensure fragments are registered

describe("PM Routing Fragments", () => {
    it("should generate PM routing instructions", () => {
        const prompt = new PromptBuilder()
            .add("pm-routing-instructions", {})
            .build();

        expect(prompt).toContain("## PM Agent Routing Instructions");
        expect(prompt).toContain("Agent Handoffs");
        expect(prompt).toContain("Phase Transitions");
        expect(prompt).toContain("next_action");
        expect(prompt).toContain("chat → plan");
        expect(prompt).toContain("plan → execute");
        expect(prompt).toContain("execute → review");
    });

    it("should generate PM handoff guidance", () => {
        const prompt = new PromptBuilder()
            .add("pm-handoff-guidance", {})
            .build();

        expect(prompt).toContain("## Agent Selection Guidance");
        expect(prompt).toContain("Agent Capabilities Match");
        expect(prompt).toContain("Developer agents");
        expect(prompt).toContain("Reviewer/Expert agents");
        expect(prompt).toContain("Specialist agents");
    });

    it("should combine both PM fragments", () => {
        const prompt = new PromptBuilder()
            .add("pm-routing-instructions", {})
            .add("pm-handoff-guidance", {})
            .build();

        expect(prompt).toContain("PM Agent Routing Instructions");
        expect(prompt).toContain("Agent Selection Guidance");
    });
});