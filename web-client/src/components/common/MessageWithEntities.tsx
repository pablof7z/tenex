import type React from "react";
import { findNostrEntities, replaceNostrEntities } from "../../utils/nostrEntityParser";
import { NostrEntityCard } from "./NostrEntityCard";

interface MessageWithEntitiesProps {
    content: string;
    className?: string;
}

export function MessageWithEntities({ content, className }: MessageWithEntitiesProps) {
    // Find all Nostr entities in the content
    const entities = findNostrEntities(content);

    // If no entities, just render the content as-is
    if (entities.length === 0) {
        return <div className={className}>{content}</div>;
    }

    // Split content and render with entity cards
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Create a map of entity positions
    const entityMap = new Map<string, (typeof entities)[0]>();
    for (const entity of entities) {
        entityMap.set(`nostr:${entity.bech32}`, entity);
    }

    // Replace entities with placeholders and collect parts
    const processedContent = replaceNostrEntities(content, (entity) => {
        const placeholder = `__ENTITY_${entity.bech32}__`;
        return placeholder;
    });

    // Split by placeholders and reconstruct with components
    const regex = /__ENTITY_([\w]+)__/g;
    let match: RegExpExecArray | null;

    match = regex.exec(processedContent);
    while (match !== null) {
        // Add text before the entity
        if (match.index > lastIndex) {
            const textBefore = processedContent.slice(lastIndex, match.index);
            if (textBefore.trim()) {
                parts.push(<span key={`text-${lastIndex}`}>{textBefore}</span>);
            }
        }

        // Add the entity card
        const bech32 = match[1];
        const entity = entityMap.get(`nostr:${bech32}`);
        if (entity) {
            parts.push(<NostrEntityCard key={`entity-${bech32}`} entity={entity} />);
        }

        lastIndex = match.index + match[0].length;
        match = regex.exec(processedContent);
    }

    // Add any remaining text
    if (lastIndex < processedContent.length) {
        const remainingText = processedContent.slice(lastIndex);
        if (remainingText.trim()) {
            parts.push(<span key={`text-${lastIndex}`}>{remainingText}</span>);
        }
    }

    return <div className={className}>{parts}</div>;
}
