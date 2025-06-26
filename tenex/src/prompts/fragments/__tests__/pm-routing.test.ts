import { PromptBuilder } from "../../core/PromptBuilder";
import "../pm-routing"; // Ensure fragments are registered

describe("PM Routing Fragments", () => {
    it("should generate PM routing instructions", () => {
        const prompt = new PromptBuilder()
            .add("pm-routing-instructions", {})
            .build();

        expect(prompt).toContain("## PM Agent Routing Instructions");
        expect(prompt).toContain("Handoff Tool");
        expect(prompt).toContain("Switch Phase Tool");
        expect(prompt).toContain("switch_phase");
        expect(prompt).toContain("chat → plan");
        expect(prompt).toContain("plan → execute");
        expect(prompt).toContain("execute → review");
        expect(prompt).toContain("IMPORTANT");
        expect(prompt).toContain("you MUST delegate to them rather than attempting it yourself");
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
        expect(prompt).toContain("Key Principle");
        expect(prompt).toContain("Each specialist excels in their domain");
        expect(prompt).toContain("delegate immediately");
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