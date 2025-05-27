import { corrections, regexCorrections, contextCorrections } from '@/config/corrections.js';

/**
 * Apply text corrections to transcribed text
 * This function handles common speech-to-text errors and improves readability
 */
export function applyTextCorrections(text: string): string {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let correctedText = text.trim();

    // Apply word-level corrections
    correctedText = applyWordCorrections(correctedText);

    // Apply regex-based corrections
    correctedText = applyRegexCorrections(correctedText);

    // Apply context-aware corrections
    correctedText = applyContextCorrections(correctedText);

    // Final cleanup
    correctedText = finalCleanup(correctedText);

    return correctedText;
}

/**
 * Apply simple word-to-word corrections
 */
function applyWordCorrections(text: string): string {
    let result = text;

    // Apply corrections case-insensitively but preserve original case when possible
    Object.entries(corrections).forEach(([wrong, correct]) => {
        if (correct === '') {
            // Remove filler words
            const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, 'gi');
            result = result.replace(regex, '');
        } else {
            // Replace with correct word, preserving case
            const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, 'gi');
            result = result.replace(regex, (match) => {
                // Preserve case pattern
                if (match === match.toUpperCase()) {
                    return correct.toUpperCase();
                }
                if (match === match.toLowerCase()) {
                    return correct.toLowerCase();
                }
                if (match[0] === match[0].toUpperCase()) {
                    return correct.charAt(0).toUpperCase() + correct.slice(1).toLowerCase();
                }
                return correct;
            });
        }
    });

    return result;
}

/**
 * Apply regex-based corrections for patterns
 */
function applyRegexCorrections(text: string): string {
    let result = text;

    regexCorrections.forEach(({ pattern, replacement }) => {
        result = result.replace(pattern, replacement);
    });

    return result;
}

/**
 * Apply context-aware corrections based on detected context
 */
function applyContextCorrections(text: string): string {
    let result = text;
    const lowerText = text.toLowerCase();

    // Detect context
    const contexts: string[] = [];
    
    if (containsDevelopmentTerms(lowerText)) {
        contexts.push('development');
    }
    
    if (containsProjectTerms(lowerText)) {
        contexts.push('project');
    }

    // Apply context-specific corrections
    contexts.forEach(context => {
        const contextDict = contextCorrections[context as keyof typeof contextCorrections];
        if (contextDict) {
            Object.entries(contextDict).forEach(([wrong, correct]) => {
                const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, 'gi');
                result = result.replace(regex, correct);
            });
        }
    });

    return result;
}

/**
 * Check if text contains development-related terms
 */
function containsDevelopmentTerms(text: string): boolean {
    const devTerms = [
        'code', 'coding', 'program', 'programming', 'develop', 'development',
        'javascript', 'typescript', 'react', 'node', 'api', 'database',
        'frontend', 'backend', 'server', 'client', 'website', 'app'
    ];
    
    return devTerms.some(term => text.includes(term));
}

/**
 * Check if text contains project management terms
 */
function containsProjectTerms(text: string): boolean {
    const projectTerms = [
        'task', 'project', 'milestone', 'deadline', 'priority', 'urgent',
        'complete', 'finish', 'start', 'todo', 'issue', 'bug', 'feature'
    ];
    
    return projectTerms.some(term => text.includes(term));
}

/**
 * Final cleanup of the text
 */
function finalCleanup(text: string): string {
    let result = text;

    // Remove multiple spaces
    result = result.replace(/\s+/g, ' ');

    // Remove spaces at the beginning and end
    result = result.trim();

    // Ensure the text starts with a capital letter
    if (result.length > 0) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    // Ensure the text ends with proper punctuation if it doesn't already
    if (result.length > 0 && !/[.!?]$/.test(result)) {
        // Only add a period if the text seems like a complete sentence
        if (result.length > 10 && /\b(is|are|was|were|have|has|had|will|would|could|should|can|may|might)\b/i.test(result)) {
            result += '.';
        }
    }

    return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get correction statistics for debugging
 */
export function getCorrectionStats(originalText: string, correctedText: string) {
    const originalWords = originalText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const correctedWords = correctedText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    const corrections = [];
    let correctionCount = 0;

    // Simple word-by-word comparison (not perfect but gives an idea)
    for (let i = 0; i < Math.min(originalWords.length, correctedWords.length); i++) {
        if (originalWords[i] !== correctedWords[i]) {
            corrections.push({
                original: originalWords[i],
                corrected: correctedWords[i],
                position: i
            });
            correctionCount++;
        }
    }

    return {
        originalWordCount: originalWords.length,
        correctedWordCount: correctedWords.length,
        correctionCount,
        corrections,
        correctionRate: originalWords.length > 0 ? correctionCount / originalWords.length : 0
    };
}