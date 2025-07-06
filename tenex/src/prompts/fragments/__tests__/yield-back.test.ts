import { describe, expect, it } from "bun:test";
import { fragmentRegistry } from "@/prompts/core/FragmentRegistry";
import "@/prompts/fragments/yield-back";

describe("yield-back fragment", () => {
  it("should be registered", () => {
    const fragment = fragmentRegistry.get("yield-back");
    expect(fragment).toBeDefined();
    expect(fragment?.id).toBe("yield-back");
  });

  it("should have correct priority", () => {
    const fragment = fragmentRegistry.get("yield-back");
    expect(fragment?.priority).toBe(350);
  });

  it("should generate control flow instructions", () => {
    const fragment = fragmentRegistry.get("yield-back");
    const content = fragment?.template({});
    
    expect(content).toContain("Task Completion Requirements");
    expect(content).toContain("star topology");
    expect(content).toContain("complete");
    expect(content).toContain("When to Use the 'complete' Tool");
    expect(content).toContain("How to Use the 'complete' Tool");
  });

  it("should explain phase-specific behavior", () => {
    const fragment = fragmentRegistry.get("yield-back");
    const content = fragment?.template({});
    
    expect(content).toContain("CHAT phase:");
    expect(content).toContain("PLAN/EXECUTE/REVIEW/CHORES/REFLECTION phases:");
  });
});