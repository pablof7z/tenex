import { describe, expect, it } from "bun:test";
import { orchestratorRoutingInstructionsFragment, orchestratorHandoffGuidanceFragment } from "../orchestrator-routing";

describe("Orchestrator Routing - Clarity-Based Decision Making", () => {
  it("should contain request clarity assessment instructions", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("Request Clarity Assessment");
    expect(result).toContain("Well-defined request:");
    expect(result).toContain("Ambiguous request:");
    expect(result).toContain("Vague/exploratory request:");
  });

  it("should specify clarity-based routing actions", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    // Well-defined requests
    expect(result).toContain("Action: Route directly to @executer (skip PLAN phase)");
    
    // Ambiguous requests
    expect(result).toContain("Action: Route to @planner first");
    
    // Vague requests
    expect(result).toContain("Action: Route to BRAINSTORM phase");
  });

  it("should contain mandatory double-consultation instructions", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("Mandatory Double-Consultation in Plan/Execute Phases");
    expect(result).toContain("you MUST always consult at least twice");
    expect(result).toContain("Even without specialist agents, self-review provides valuable quality assurance");
  });

  it("should contain availability-based review strategy", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("Availability-Based Review Strategy:");
    expect(result).toContain("If relevant experts exist: Route to them for domain-specific review");
    expect(result).toContain("If no relevant experts: Ask @executer to self-review their work");
    expect(result).toContain("If multiple relevant experts: Query them in parallel for comprehensive feedback");
  });

  it("should enforce mandatory post-execute phases", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("After EXECUTE: Always proceed to REVIEW (mandatory)");
    expect(result).toContain("CHORES to REFLECTION) are mandatory");
    expect(result).toContain("Never skip review after execute");
  });

  it("should specify orchestrator end_conversation() usage", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("In REFLECTION phase: Use end_conversation() to provide a comprehensive summary of the entire workflow");
    expect(result).toContain("ONLY when the ENTIRE task is finished and ALL post-execute phases are completed");
  });

  it("should contain feedback collection instructions", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("Collecting Agent Summaries:");
    expect(result).toContain("When agents use complete(), they provide detailed summaries of their work");
    expect(result).toContain("Forward feedback verbatim when routing back for fixes");
  });

  it("should specify review-execute feedback loop", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("Review Decision Point:");
    expect(result).toContain("Issues Found ---> Loop back to EXECUTE (with specific feedback)");
    expect(result).toContain("Work Acceptable ---> Proceed to CHORES");
    expect(result).toContain("Continue loop until acceptable");
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
    expect(result).toContain("What expertise is most critical right now?");
  });
});

describe("Orchestrator No Assumptions Principle", () => {
  it("should explicitly forbid adding assumptions", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("CRITICAL: NO GUESSING OR ASSUMPTIONS");
    expect(result).toContain("ONLY pass information that was EXPLICITLY stated by the user");
    expect(result).toContain("Never guess features, requirements, or implementation details");
  });

  it("should provide clear examples of no assumptions", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    // Should show calculator example
    expect(result).toContain('"build a calculator" → Pass exactly "build a calculator"');
    expect(result).toContain("do NOT add \"with basic arithmetic operations\"");
  });

  it("should show BAD examples of adding assumptions", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("BAD Examples - Adding Assumptions (DO NOT DO THIS)");
    expect(result).toContain("❌ User said \"build a calculator\" but you added assumptions");
    expect(result).toContain("❌ User said \"add login\" but you added security assumptions");
  });

  it("should emphasize passing only explicit user statements", () => {
    const result = orchestratorRoutingInstructionsFragment.template();
    
    expect(result).toContain("Message Quality - NO ASSUMPTIONS:");
    expect(result).toContain("Pass the user's exact words");
    expect(result).toContain("Aggregate ONLY explicit statements");
  });
});