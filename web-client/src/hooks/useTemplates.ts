import { NDKProjectTemplate, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useMemo } from "react";

export function useTemplates(options?: {
    search?: string;
    tags?: string[];
    author?: string;
    limit?: number;
}) {
    const { search = "", tags = [], author, limit = 50 } = options || {};

    const filters = useMemo(() => {
        const baseFilter: {
            kinds: number[];
            limit: number;
            authors?: string[];
            "#t"?: string[];
        } = {
            kinds: [NDKProjectTemplate.kind],
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

    const { events: templateEvents } = useSubscribe<NDKProjectTemplate>(filters, { wrap: true }, [
        author,
        tags.join(","),
        limit,
    ]);

    const templates = useMemo(() => {
        if (!templateEvents) return [];

        const templatesMap = new Map<string, NDKProjectTemplate>();

        for (const template of templateEvents) {
            const d = template.tagId();

            if (!d) continue;

            if (search) {
                const title = template.tagValue("title") || "";
                const description = template.tagValue("description") || "";
                const tags = template.tags
                    .filter((tag) => tag[0] === "t" && tag[1])
                    .map((tag) => tag[1] as string);

                if (
                    !title.toLowerCase().includes(search.toLowerCase()) &&
                    !description.toLowerCase().includes(search.toLowerCase()) &&
                    !tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
                ) {
                    continue;
                }
            }

            const existing = templatesMap.get(d);
            if (!existing || template.created_at! > existing.created_at!) {
                templatesMap.set(d, template);
            }
        }

        return Array.from(templatesMap.values()).sort((a, b) => b.created_at! - a.created_at!);
    }, [templateEvents, search]);

    return {
        templates,
        loading: false,
    };
}
