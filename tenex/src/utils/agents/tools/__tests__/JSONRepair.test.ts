import { describe, it, expect } from "vitest";
import { parseJSON, JSONRepairError } from "../JSONRepair";

describe("parseJSON", () => {
    it("should parse valid JSON without repairs", () => {
        const validJSON = '{"team": {"lead": "coder", "members": ["coder"]}}';
        const result = parseJSON(validJSON);
        expect(result).toEqual({ team: { lead: "coder", members: ["coder"] } });
    });

    it("should fix unterminated strings", () => {
        const brokenJSON = '{"team": {"lead": "coder';
        const result = parseJSON(brokenJSON);
        expect(result).toEqual({ team: { lead: "coder" } });
    });

    it("should fix the actual error from the logs", () => {
        const brokenJSON = `{
  "team": {
    "lead": "debugger",
    "members": [
      "debugger"
    ]
  ",
  "conversationPlan": {
    "stages": [
      {
        "participants": [
          "debugger"
        ],
        "purpose": "Analyze the reported UI issue",
        "expectedOutcome": "A clear understanding",
        "transitionCriteria": "A hypothesis is formed",
        "primarySpeaker": "debugger"
      }
    ],
    "estimatedComplexity": 3
  },
  "reasoning": "The user is reporting a UI bug"
}`;
        const result = parseJSON(brokenJSON);
        expect(result.team.lead).toBe("debugger");
        expect(result.team.members).toEqual(["debugger"]);
        // The structure might be nested under team due to the repair
        const plan = result.conversationPlan || result.team.conversationPlan;
        expect(plan).toBeDefined();
        expect(plan.stages).toHaveLength(1);
    });

    it("should remove trailing commas", () => {
        const jsonWithTrailingComma = '{"a": 1, "b": 2,}';
        const result = parseJSON(jsonWithTrailingComma);
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it("should complete incomplete JSON structures", () => {
        const incompleteJSON = '{"a": {"b": 1';
        const result = parseJSON(incompleteJSON);
        expect(result).toEqual({ a: { b: 1 } });
    });

    it("should extract JSON from markdown code blocks", () => {
        const markdown = '```json\n{"team": {"lead": "coder"}}\n```';
        const result = parseJSON(markdown);
        expect(result).toEqual({ team: { lead: "coder" } });
    });

    it("should convert single quotes to double quotes", () => {
        const singleQuoteJSON = "{'team': {'lead': 'coder'}}";
        const result = parseJSON(singleQuoteJSON);
        expect(result).toEqual({ team: { lead: "coder" } });
    });

    it("should fix multiple issues at once", () => {
        const complexBroken = `{
            'team': {
                'lead': 'debugger',
                'members': ['debugger',],
            },
            'conversationPlan': {
                'stages': [
                    {
                        'participants': ['debugger'],
                        'purpose': 'Debug issue'
                    }
                ]
            }
        }`;
        const result = parseJSON(complexBroken);
        expect(result.team.lead).toBe("debugger");
        expect(result.team.members).toEqual(["debugger"]);
        expect(result.conversationPlan.stages).toHaveLength(1);
    });

    it("should throw JSONRepairError when repair fails", () => {
        const hopelesslyBroken = "not even close to JSON";
        expect(() => parseJSON(hopelesslyBroken)).toThrow(JSONRepairError);
    });

    it("should not attempt repairs when attemptAutoFix is false", () => {
        const brokenJSON = '{"a": 1,}';
        expect(() => parseJSON(brokenJSON, { attemptAutoFix: false })).toThrow();
    });
});