"use client";

import { useSubscribe } from "@nostr-dev-kit/ndk-hooks";
import { useEffect } from "react";

export default function TestTemplatesPage() {
    // Subscribe to template events
    const { events, eose } = useSubscribe(
        [{ kinds: [30717], limit: 50 }],
        {},
        []
    );

    useEffect(() => {
        if (events && events.length > 0) {
            console.log(`[TestTemplates] Found ${events.length} template events`);
            events.forEach((event, index) => {
                console.log(`[TestTemplates] Event ${index}:`, {
                    id: event.id,
                    pubkey: event.pubkey,
                    tags: event.tags,
                    content: event.content,
                    created_at: event.created_at
                });
            });
        }
    }, [events]);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Template Debug Page</h1>
            <p>Check the browser console for template event details.</p>
            <div>
                <p>Events found: {events?.length || 0}</p>
                <p>End of subscription: {eose ? "Yes" : "No"}</p>
            </div>
            {events && events.length > 0 && (
                <div className="mt-4 space-y-4">
                    <h2 className="text-xl font-semibold">Raw Events:</h2>
                    {events.map((event, index) => (
                        <div key={event.id || index} className="border p-4 rounded">
                            <p><strong>Event {index}:</strong></p>
                            <p>ID: {event.id}</p>
                            <p>Pubkey: {event.pubkey}</p>
                            <p>Content: {event.content}</p>
                            <details>
                                <summary>Tags ({event.tags.length})</summary>
                                <pre className="text-xs">{JSON.stringify(event.tags, null, 2)}</pre>
                            </details>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}