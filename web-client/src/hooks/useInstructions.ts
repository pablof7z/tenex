import type { NDKKind } from "@nostr-dev-kit/ndk";
import type { NDKFilter } from "@nostr-dev-kit/ndk";
import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useMemo } from "react";
import type { NDKLLMRule } from "../types/template";

const INSTRUCTION_KIND = 1339;

export function useInstructions(options?: {
    search?: string;
    tags?: string[];
    author?: string;
    limit?: number;
}) {
    const { search = "", tags = [], author, limit = 100 } = options || {};

    const filters = useMemo(() => {
        const baseFilter: NDKFilter = {
            kinds: [INSTRUCTION_KIND as NDKKind],
            limit,
        };

        if (author) {
            baseFilter.authors = [author];
        }

        if (tags.length > 0) {
            baseFilter["#t"] = tags;
        }

        return [baseFilter];
    }, [author, tags, limit]);

    const { events: instructionEvents } = useSubscribe<NDKLLMRule>(filters, { wrap: true }, [
        author,
        tags.join(","),
        limit,
    ]);

    const instructions = useMemo(() => {
        if (!instructionEvents) return [];

        const instructionsMap = new Map<string, NDKLLMRule>();

        for (const instruction of instructionEvents) {
            const title = instruction.tagValue("title") || "";
            const description = instruction.tagValue("description") || "";
            const author = instruction.pubkey;

            if (search) {
                const content = instruction.content || "";
                const tags =
                    instruction
                        .getMatchingTags("t")
                        .map((tag) => tag[1])
                        .filter((t): t is string => t !== undefined) || [];

                if (
                    !title.toLowerCase().includes(search.toLowerCase()) &&
                    !description.toLowerCase().includes(search.toLowerCase()) &&
                    !content.toLowerCase().includes(search.toLowerCase()) &&
                    !tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
                ) {
                    continue;
                }
            }

            const key = `${title}:${author}`;
            const existing = instructionsMap.get(key);
            if (!existing || instruction.created_at! > existing.created_at!) {
                instructionsMap.set(key, {
                    ...instruction,
                    title,
                    description,
                    version: instruction.tagValue("ver") || "1",
                    hashtags: instruction.getMatchingTags("t").map((tag) => tag[1]),
                } as NDKLLMRule);
            }
        }

        return Array.from(instructionsMap.values()).sort((a, b) => b.created_at! - a.created_at!);
    }, [instructionEvents, search]);

    return {
        instructions,
        loading: false,
    };
}
