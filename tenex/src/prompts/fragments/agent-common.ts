// Common utility functions for agent prompts

export function buildAgentIdentity(name: string, role?: string): string {
    return role ? `You are ${name}, a ${role}` : `You are ${name}`;
}

export function buildAgentPrompt(args: {
    name: string;
    role?: string;
    instructions: string;
    projectName?: string;
}): string {
    const parts: string[] = [];

    // Identity
    parts.push(buildAgentIdentity(args.name, args.role));

    // Instructions
    if (args.instructions) {
        parts.push(`## Your Role\n${args.instructions}`);
    }

    // Project context
    if (args.projectName) {
        parts.push(`## Project Context\n- Project: ${args.projectName}`);
    }

    return parts.join("\n\n");
}
