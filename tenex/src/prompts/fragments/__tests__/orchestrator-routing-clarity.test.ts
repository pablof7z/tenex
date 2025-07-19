import { describe, expect, it } from "bun:test";
import {
    orchestratorRoutingInstructionsFragment,
    orchestratorHandoffGuidanceFragment,
} from "../orchestrator-routing";

describe("Orchestrator Routing - Clarity-Based Decision Making", () => {
    it("should contain request clarity assessment instructions", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain("Request Assessment");
        expect(result).toContain("Clear requests");
        expect(result).toContain("Ambiguous requests");
        expect(result).toContain("Exploratory requests");
    });

    it("should specify clarity-based routing actions", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        // Clear requests
        expect(result).toContain("Route directly to execute phase");

        // Ambiguous requests
        expect(result).toContain("Route to plan phase first");

        // Exploratory requests
        expect(result).toContain("Route to brainstorm phase");
    });

    it("should contain mandatory double-consultation instructions", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain("Minimum Continue Call Requirements:");
        expect(result).toContain("You MUST use the continue tool at least TWICE");
        expect(result).toContain(
            "If no domain experts are available, route back to the default agent"
        );
    });

    it("should contain availability-based verification strategy", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain("Quality Control in Execute and Plan Phases");
        expect(result).toContain("Request verification or validation of the work");
        expect(result).toContain(
            "route back to the default agent (planner/executor) for self-assessment"
        );
        expect(result).toContain(
            "Request domain-specific verification from experts or self-assessment"
        );
    });

    it("should enforce mandatory post-execute phases", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain(
            "After execution work, you MUST proceed through VERIFICATION → CHORES → REFLECTION"
        );
        expect(result).toContain("VERIFICATION Phase** (recommended after execute)");
        expect(result).toContain("Only skip if**: User explicitly requests to skip");
    });

    it("should specify orchestrator end_conversation() usage", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain(
            "Use end_conversation() ONLY when ALL necessary phases are complete"
        );
        expect(result).toContain("Include final summary of the entire conversation");
    });

    it("should contain feedback collection instructions", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain("Agent Completion Handoffs");
        expect(result).toContain(
            "When agents use complete(), they provide detailed summaries of their work"
        );
        expect(result).toContain(
            "Collect these summaries to build context for subsequent routing decisions"
        );
    });

    it("should specify verification-execute feedback loop", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain("If issues found: Loop back to execute");
        expect(result).toContain("If acceptable: Proceed to chores");
        expect(result).toContain("Quality assessment and validation from end-user perspective");
    });
});

describe("Orchestrator Handoff Guidance", () => {
    it("should not mention complexity assessment", () => {
        const routingResult = orchestratorRoutingInstructionsFragment.template();
        const handoffResult = orchestratorHandoffGuidanceFragment.template();

        // Should not contain "complexity" or "complex" in the context of task assessment
        expect(routingResult).not.toContain("Task Complexity Assessment");
        expect(handoffResult).not.toContain("assess the complexity");
    });

    it("should emphasize agent availability for routing decisions", () => {
        const result = orchestratorHandoffGuidanceFragment.template();

        expect(result).toContain("Agent Capabilities Match");
        expect(result).toContain("When to Use Multi-Agent Queries");
        expect(result).toContain("Gathering specialized knowledge from domain experts");
    });
});

describe("Orchestrator No Assumptions Principle", () => {
    it("should explicitly forbid adding assumptions", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain("Pass ONLY what the user explicitly stated");
        expect(result).toContain("Never add assumptions");
        expect(result).toContain("Let specialist agents ask for clarification if needed");
    });

    it("should provide clear examples of no assumptions", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        // Should show calculator example
        expect(result).toContain(
            '"Build a calculator" → Pass exactly "@executor, build a calculator"'
        );
        expect(result).toContain(
            'Never add assumptions like "with basic operations" or "follow best practices"'
        );
    });

    it("should show BAD examples of adding assumptions", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain(
            'Never add assumptions like "with basic operations" or "follow best practices"'
        );
        expect(result).toContain("Pass ONLY what the user explicitly stated");
        expect(result).toContain("Let specialist agents ask for clarification if needed");
    });

    it("should emphasize passing only explicit user statements", () => {
        const result = orchestratorRoutingInstructionsFragment.template();

        expect(result).toContain("Message Passing Rules:");
        expect(result).toContain("Pass ONLY what the user explicitly stated");
        expect(result).toContain("Prefix messages with the target agent's slug using @ notation");
    });
});
