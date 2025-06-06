import { useMemo } from 'react';
import { useSubscribe } from '@nostr-dev-kit/ndk-hooks';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { NostrTemplate, TemplateFilters, TEMPLATE_KIND } from '@/types/template';

/**
 * Hook for fetching and parsing nostr template events (kind 30717)
 * 
 * @param filters Optional filters to apply to template search
 * @returns Object containing templates array and eose flag
 */
export function useTemplates(filters?: TemplateFilters) {
    // Build NDK filters based on provided filters
    const ndkFilters = useMemo((): NDKFilter[] | false => {
        const baseFilter: NDKFilter = {
            kinds: [TEMPLATE_KIND],
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
            baseFilter['#t'] = filters.tags;
        }

        return [baseFilter];
    }, [filters?.author, filters?.tags]);

    // Subscribe to template events using NDK
    const { events, eose } = useSubscribe(
        ndkFilters,
        {}, // No special subscription options needed
        [filters?.author, filters?.tags] // Dependencies for re-subscription
    );

    // Parse events into NostrTemplate objects and apply search filter
    const templates = useMemo((): NostrTemplate[] => {
        if (!events || events.length === 0) {
            return [];
        }

        const parsedTemplates = events
            .map(parseEventToTemplate)
            .filter((template): template is NostrTemplate => template !== null);

        // Apply search filter if specified
        if (filters?.search) {
            const searchTerm = filters.search.toLowerCase();
            return parsedTemplates.filter(template => 
                template.name.toLowerCase().includes(searchTerm) ||
                template.description.toLowerCase().includes(searchTerm) ||
                template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        return parsedTemplates;
    }, [events, filters?.search]);

    return {
        templates,
        eose
    };
}

/**
 * Parse an NDK event into a NostrTemplate object
 * 
 * @param event NDK event to parse
 * @returns Parsed NostrTemplate or null if parsing fails
 */
function parseEventToTemplate(event: NDKEvent): NostrTemplate | null {
    try {
        // Extract required fields from tags
        const dTag = event.tagValue('d');
        const nameTag = event.tagValue('name');
        const descriptionTag = event.tagValue('description');

        // Validate required fields
        if (!dTag || !nameTag || !descriptionTag) {
            console.warn('Template event missing required tags:', {
                id: event.id,
                dTag,
                nameTag,
                descriptionTag
            });
            return null;
        }

        // Extract optional fields
        const imageTag = event.tagValue('image');
        
        // Extract all 't' tags for template tags
        const templateTags = event.getMatchingTags('t').map(tag => tag[1]).filter(Boolean);

        // Extract git repository URL from content
        const repoUrl = event.content?.trim() || '';

        // Validate repo URL format (should be git+https://...)
        if (!repoUrl || !repoUrl.startsWith('git+https://')) {
            console.warn('Template event has invalid or missing repo URL:', {
                id: event.id,
                repoUrl
            });
            return null;
        }

        // Create NostrTemplate object
        const template: NostrTemplate = {
            id: dTag,
            name: nameTag,
            description: descriptionTag,
            image: imageTag || undefined,
            tags: templateTags,
            repoUrl,
            authorPubkey: event.pubkey,
            createdAt: event.created_at || 0,
            event
        };

        return template;
    } catch (error) {
        console.error('Error parsing template event:', error, event);
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
        return templates.find(template => template.id === templateId) || null;
    }, [templates, templateId]);
}