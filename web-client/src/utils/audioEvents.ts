import { NDKEvent } from "@nostr-dev-kit/ndk";

// Maximum number of waveform samples to display in UI
export const MAX_WAVEFORM_SAMPLES = 100;

/**
 * Check if an event is an audio file event
 */
export function isAudioEvent(event: NDKEvent): boolean {
    // NIP-94 audio events
    if (event.kind === 1063) {
        const mimeType = event.tags.find(tag => tag[0] === "m" && tag.length > 1)?.[1];
        return mimeType?.startsWith("audio/") || false;
    }
    
    // Legacy NIP-A0 audio events
    if (event.kind === 1222 || event.kind === 1223) {
        return true;
    }
    
    return false;
}

/**
 * Extract audio URL from event
 */
export function getAudioURL(event: NDKEvent): string | undefined {
    // NIP-94 events store URL in tags
    if (event.kind === 1063) {
        return event.tags.find(tag => tag[0] === "url" && tag.length > 1)?.[1];
    }
    
    // Legacy NIP-A0 events store URL in content
    if (event.kind === 1222 || event.kind === 1223) {
        return event.content;
    }
    
    return undefined;
}

/**
 * Extract duration from event
 */
export function getAudioDuration(event: NDKEvent): number {
    // NIP-94 events
    if (event.kind === 1063) {
        const durationTag = event.tags.find(tag => tag[0] === "duration" && tag.length > 1)?.[1];
        return durationTag ? parseInt(durationTag) : 0;
    }
    
    // Legacy NIP-A0 events - check imeta tag
    if (event.kind === 1222 || event.kind === 1223) {
        const imetaTag = event.tags.find(tag => tag[0] === "imeta");
        if (imetaTag) {
            const durationPart = imetaTag.find(part => typeof part === 'string' && part.includes("duration"));
            if (durationPart) {
                const match = durationPart.match(/duration (\d+)/);
                return match ? parseInt(match[1]) : 0;
            }
        }
    }
    
    return 0;
}

/**
 * Extract waveform from event
 */
export function getAudioWaveform(event: NDKEvent): number[] {
    // NIP-94 events
    if (event.kind === 1063) {
        const waveformTag = event.tags.find(tag => tag[0] === "waveform" && tag.length > 1)?.[1];
        if (!waveformTag) return [];
        
        return waveformTag.split(" ").map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0 && v <= 1);
    }
    
    // Legacy NIP-A0 events - check imeta tag
    if (event.kind === 1222 || event.kind === 1223) {
        const imetaTag = event.tags.find(tag => tag[0] === "imeta");
        if (imetaTag) {
            const waveformPart = imetaTag.find(part => typeof part === 'string' && part.includes("waveform"));
            if (waveformPart) {
                const match = waveformPart.match(/waveform (.+)/);
                if (match && match[1]) {
                    return match[1].split(" ").map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0 && v <= 1);
                }
            }
        }
    }
    
    return [];
}