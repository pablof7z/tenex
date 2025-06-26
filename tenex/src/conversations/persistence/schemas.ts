import { z } from "zod";

const PhaseSchema = z.enum(["chat", "brainstorm", "plan", "execute", "review", "chores"]);

export const PhaseTransitionSchema = z.object({
    from: PhaseSchema,
    to: PhaseSchema,
    message: z.string(),
    timestamp: z.number(),
    agentPubkey: z.string(),
    agentName: z.string(),
    reason: z.string().optional(),
});

export const ConversationMetadataSchema = z.record(z.string(), z.unknown());

export const SerializedConversationSchema = z.object({
    id: z.string(),
    title: z.string(),
    phase: PhaseSchema,
    history: z.array(z.string()),
    phaseStartedAt: z.number().optional(),
    metadata: ConversationMetadataSchema,
    phaseTransitions: z.array(PhaseTransitionSchema).default([]),
});

export const ConversationMetadataFileSchema = z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    phase: z.string(),
    eventCount: z.number(),
    agentCount: z.number(),
    archived: z.boolean().optional(),
});

export const MetadataFileSchema = z.object({
    conversations: z.array(ConversationMetadataFileSchema),
});

export type SerializedConversation = z.infer<typeof SerializedConversationSchema>;
export type MetadataFile = z.infer<typeof MetadataFileSchema>;