import type { NDKEvent, NDKProjectTemplate } from "@nostr-dev-kit/ndk-hooks";
import type { TelemetryConfig } from "@tenex/types/telemetry";
import type { NDKAgent } from "../events/agent";

export interface NDKLLMRule extends NDKEvent {
    title?: string;
    description?: string;
    version?: string;
    hashtags?: string[];
}

export interface InstructionWithAgents extends NDKLLMRule {
    assignedAgents?: string[];
}

export interface ProjectFormData {
    name: string;
    description: string;
    hashtags: string;
    repoUrl?: string;
    imageUrl?: string;
    selectedTemplate?: NDKProjectTemplate;
    selectedAgents?: NDKAgent[];
    selectedInstructions?: InstructionWithAgents[];
    telemetryConfig?: TelemetryConfig;
    enableTelemetry?: boolean;
}

export interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProjectCreated?: () => void;
}

export type CreateProjectStep =
    | "details"
    | "template"
    | "agents"
    | "instructions"
    | "telemetry"
    | "confirm";
