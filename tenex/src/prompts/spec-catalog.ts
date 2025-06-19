/**
 * Spec catalog template for available project specifications
 */
import type { SpecSummary } from "./composer";

export const SPEC_CATALOG_PROMPT = (specs: SpecSummary[]) => {
    if (!specs || specs.length === 0) {
        return "";
    }

    const specList = specs
        .map((spec) => `- **${spec.title}**: ${spec.summary} (d-tag: ${spec.dTag})`)
        .join("\n");

    return `

AVAILABLE PROJECT SPECIFICATIONS:
${specList}

You can access the full content of any specification using the read_specs tool with the d-tag identifier.`;
};
