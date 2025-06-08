import { type NostrTemplate, TEMPLATE_KIND, type TemplateFilters } from "@/types/template";
import { type NDKFilter, useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { nip19 } from "nostr-tools";
import { useMemo } from "react";

// Define the filter interface to avoid type conflicts
interface NostrFilter {
    kinds?: number[];
    authors?: string[];
    limit?: number;
    "#t"?: string[];
    [key: string]: unknown;
}

// Define the event interface to avoid type conflicts
interface NostrEvent {
    id?: string;
    pubkey: string;
    created_at?: number;
    content?: string;
    tags: string[][];
    tagValue(tagName: string): string | undefined;
    getMatchingTags(tagName: string): string[][];
}

/**
 * Hook for fetching and parsing nostr template events (kind 30717)
 *
 * @param filters Optional filters to apply to template search
 * @returns Object containing templates array and eose flag
 */
export function useTemplates(filters?: TemplateFilters) {
    // Build NDK filters based on provided filters
    const ndkFilters = useMemo<NDKFilter[]>(() => {
        const baseFilter: NostrFilter = {
            kinds: [TEMPLATE_KIND as number],
            limit: 100, // Reasonable limit for templates
        };

        // Add author filter if specified
        if (filters?.author) {
            baseFilter.authors = [filters.author];
        }

        // Add tag filters if specified
        if (filters?.tags && filters.tags.length > 0) {
            // For each tag, we want templates that have that tag
            // NDK will handle the OR logic for multiple tags
            baseFilter["#t"] = filters.tags;
        }

        return [baseFilter];
    }, [filters?.author, filters?.tags]);

    // Subscribe to template events using NDK
    const { events, eose } = useSubscribe(
        ndkFilters,
        {}, // No special subscription options needed
        [filters?.author, filters?.tags], // Dependencies for re-subscription
    );

    // Parse events into NostrTemplate objects and apply search filter
    const templates = useMemo((): NostrTemplate[] => {
        if (!events || events.length === 0) {
            return [];
        }

        console.log(`[useTemplates] Processing ${events.length} template events`);

        const parsedTemplates = events
            .map((event: NostrEvent) => {
                const template = parseEventToTemplate(event);
                if (!template) {
                    console.log(`[useTemplates] Failed to parse template event:`, event.id);
                }
                return template;
            })
            .filter((template): template is NostrTemplate => template !== null);

        console.log(`[useTemplates] Successfully parsed ${parsedTemplates.length} templates`);

        // Log template IDs to check for duplicates
        const templateIds = parsedTemplates.map((t) => t.id);
        const uniqueIds = new Set(templateIds);
        if (templateIds.length !== uniqueIds.size) {
            console.log(
                `[useTemplates] Found duplicate template IDs. Total: ${templateIds.length}, Unique: ${uniqueIds.size}`,
            );
            console.log(`[useTemplates] Template IDs:`, templateIds);
        }

        // Deduplicate templates by ID (keep the most recent one)
        const deduplicatedTemplates = parsedTemplates.reduce((acc, template) => {
            const existing = acc.find((t) => t.id === template.id);
            if (!existing || template.createdAt > existing.createdAt) {
                // Remove old one if exists and add new one
                return [...acc.filter((t) => t.id !== template.id), template];
            }
            return acc;
        }, [] as NostrTemplate[]);

        console.log(`[useTemplates] After deduplication: ${deduplicatedTemplates.length} unique templates`);

        // Apply search filter if specified
        if (filters?.search) {
            const searchTerm = filters.search.toLowerCase();
            return deduplicatedTemplates.filter(
                (template) =>
                    template.name.toLowerCase().includes(searchTerm) ||
                    template.description.toLowerCase().includes(searchTerm) ||
                    template.tags.some((tag) => tag.toLowerCase().includes(searchTerm)),
            );
        }

        return deduplicatedTemplates;
    }, [events, filters?.search]);

    return {
        templates,
        eose,
    };
}

/**
 * Parse an NDK event into a NostrTemplate object
 *
 * @param event NDK event to parse
 * @returns Parsed NostrTemplate or null if parsing fails
 */
function parseEventToTemplate(event: NostrEvent): NostrTemplate | null {
    try {
        // Extract required fields from tags
        const dTag = event.tagValue("d");
        const nameTag = event.tagValue("title") ?? event.tagValue("name");
        const descriptionTag = event.tagValue("description");

        // Validate required fields
        if (!dTag || !nameTag || !descriptionTag) {
            console.warn("Template event missing required tags:", {
                id: event.id,
                dTag,
                nameTag,
                descriptionTag,
                allTags: event.tags,
            });
            return null;
        }

        // Extract optional fields
        const imageTag = event.tagValue("image");
        const uriTag = event.tagValue("uri");
        const commandTag = event.tagValue("command");
        const agentTag = event.tagValue("agent");

        // Extract all 't' tags for template tags
        const templateTags = event
            .getMatchingTags("t")
            .map((tag: string[]) => tag[1])
            .filter(Boolean);

        // Extract git repository URL from 'uri' tag
        const repoUrl = uriTag?.trim() || "";

        // Log but don't reject templates with invalid repo URLs
        if (!repoUrl || !repoUrl.startsWith("git+https://")) {
            console.warn("Template event has invalid or missing repo URL:", {
                id: event.id,
                repoUrl,
                uriTag,
            });
            // Don't return null - allow templates with missing/invalid repos
        }

        // Parse agent configuration if present
        let agentConfig: object | undefined;
        if (agentTag) {
            try {
                agentConfig = JSON.parse(agentTag);
            } catch (error) {
                console.warn("Failed to parse agent config for template:", {
                    id: event.id,
                    agentTag,
                    error,
                });
            }
        }

        // Generate naddr for the template
        const naddr = nip19.naddrEncode({
            kind: TEMPLATE_KIND,
            pubkey: event.pubkey,
            identifier: dTag,
        });

        // Create NostrTemplate object
        const template: NostrTemplate = {
            id: dTag,
            name: nameTag,
            description: descriptionTag,
            image: imageTag || undefined,
            tags: templateTags,
            repoUrl,
            command: commandTag || undefined,
            agent: agentConfig,
            content: event.content?.trim() || undefined,
            authorPubkey: event.pubkey,
            createdAt: event.created_at || 0,
            event: event as unknown as NostrTemplate["event"],
            naddr,
        };

        return template;
    } catch (error) {
        console.error("Error parsing template event:", error, event);
        return null;
    }
}

/**
 * Hook for fetching a single template by ID
 *
 * @param templateId Template ID to fetch
 * @returns Single template or null if not found
 */
export function useTemplate(templateId: string): NostrTemplate | null {
    const { templates } = useTemplates();

    return useMemo(() => {
        return templates.find((template) => template.id === templateId) || null;
    }, [templates, templateId]);
}
