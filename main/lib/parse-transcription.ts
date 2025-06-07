/**
 * Parse transcribed text into title and description
 * This function intelligently splits voice transcriptions into meaningful title and description parts
 */

interface ParsedTranscription {
    title: string;
    description: string;
}

export function parseTranscription(text: string): ParsedTranscription {
    if (!text || typeof text !== "string") {
        return { title: "", description: "" };
    }

    const cleanText = text.trim();

    if (cleanText.length === 0) {
        return { title: "", description: "" };
    }

    // Try different parsing strategies
    const result =
        parseByExplicitStructure(cleanText) ||
        parseByPunctuation(cleanText) ||
        parseByLength(cleanText) ||
        parseByKeywords(cleanText) ||
        parseAsDefault(cleanText);

    // Ensure title is not too long and description is meaningful
    return cleanupParsedResult(result);
}

/**
 * Parse text that has explicit structure indicators
 * e.g., "Title: Create login page. Description: We need to..."
 */
function parseByExplicitStructure(text: string): ParsedTranscription | null {
    // Look for explicit title/description markers
    const titleDescPattern = /^(?:title[:\s]+)(.+?)(?:\s*(?:description|desc)[:\s]+)(.+)$/i;
    const match = text.match(titleDescPattern);

    if (match) {
        return {
            title: match[1].trim(),
            description: match[2].trim(),
        };
    }

    // Look for "Create task" or similar patterns
    const taskPattern = /^(?:create|add|make)\s+(?:a\s+)?(?:task|item|todo)(?:\s+(?:for|to|about))?\s*[:\-]?\s*(.+)$/i;
    const taskMatch = text.match(taskPattern);

    if (taskMatch) {
        const content = taskMatch[1].trim();
        return parseByPunctuation(content) || parseByLength(content);
    }

    return null;
}

/**
 * Parse by punctuation - split at first major punctuation
 */
function parseByPunctuation(text: string): ParsedTranscription | null {
    // Split at first sentence-ending punctuation
    const sentenceEndPattern = /^([^.!?]+[.!?])\s*(.*)$/;
    const match = text.match(sentenceEndPattern);

    if (match && match[1] && match[2]) {
        const title = match[1].replace(/[.!?]+$/, "").trim();
        const description = match[2].trim();

        // Only use this if both parts are meaningful
        if (title.length >= 3 && description.length >= 10) {
            return { title, description };
        }
    }

    // Try splitting at colon or dash
    const colonPattern = /^([^:\-]+)[:\-]\s*(.+)$/;
    const colonMatch = text.match(colonPattern);

    if (colonMatch && colonMatch[1] && colonMatch[2]) {
        const title = colonMatch[1].trim();
        const description = colonMatch[2].trim();

        if (title.length >= 3 && description.length >= 5) {
            return { title, description };
        }
    }

    return null;
}

/**
 * Parse by length - take first reasonable chunk as title
 */
function parseByLength(text: string): ParsedTranscription | null {
    const words = text.split(/\s+/);

    if (words.length < 3) {
        return null; // Too short to split meaningfully
    }

    // Find a good breaking point (3-8 words for title)
    let titleEndIndex = -1;

    for (let i = 2; i < Math.min(8, words.length - 1); i++) {
        const word = words[i];

        // Break at natural stopping points
        if (word.endsWith(".") || word.endsWith("!") || word.endsWith("?")) {
            titleEndIndex = i;
            break;
        }

        // Break at conjunctions that might indicate elaboration
        if (["and", "but", "so", "because", "since", "when", "where", "that", "which"].includes(word.toLowerCase())) {
            titleEndIndex = i - 1;
            break;
        }
    }

    // If no natural break found, use length-based approach
    if (titleEndIndex === -1) {
        if (words.length <= 6) {
            return null; // Too short to split
        }

        // Take first 4-6 words as title
        titleEndIndex = Math.min(5, Math.floor(words.length * 0.4));
    }

    const titleWords = words.slice(0, titleEndIndex + 1);
    const descriptionWords = words.slice(titleEndIndex + 1);

    if (descriptionWords.length < 2) {
        return null; // Description would be too short
    }

    const title = titleWords.join(" ").replace(/[.!?]+$/, "");
    const description = descriptionWords.join(" ");

    return { title, description };
}

/**
 * Parse by looking for action keywords that might indicate task structure
 */
function parseByKeywords(text: string): ParsedTranscription | null {
    const actionKeywords = [
        "implement",
        "create",
        "build",
        "develop",
        "design",
        "fix",
        "update",
        "add",
        "remove",
        "refactor",
        "optimize",
        "test",
        "deploy",
        "setup",
        "configure",
        "install",
        "integrate",
        "research",
        "investigate",
    ];

    const words = text.split(/\s+/);
    const lowerText = text.toLowerCase();

    // Look for action keyword followed by object
    for (const keyword of actionKeywords) {
        const keywordIndex = lowerText.indexOf(keyword);
        if (keywordIndex !== -1) {
            // Find the end of the likely title (action + object)
            const afterKeyword = text.substring(keywordIndex);
            const sentences = afterKeyword.split(/[.!?]+/);

            if (sentences.length > 1 && sentences[0].trim().length > 0) {
                const title = sentences[0].trim();
                const description = sentences.slice(1).join(". ").trim();

                if (title.length >= 5 && description.length >= 10) {
                    return { title, description };
                }
            }
        }
    }

    return null;
}

/**
 * Default parsing when other methods fail
 */
function parseAsDefault(text: string): ParsedTranscription {
    const words = text.split(/\s+/);

    if (words.length <= 4) {
        // Very short text - use as title only
        return {
            title: text,
            description: "",
        };
    }

    // Take first half as title, second half as description
    const midPoint = Math.floor(words.length / 2);
    const title = words
        .slice(0, midPoint)
        .join(" ")
        .replace(/[.!?]+$/, "");
    const description = words.slice(midPoint).join(" ");

    return { title, description };
}

/**
 * Clean up and validate the parsed result
 */
function cleanupParsedResult(result: ParsedTranscription): ParsedTranscription {
    let { title, description } = result;

    // Clean up title
    title = title.trim();
    if (title.length > 100) {
        // Title too long, truncate at word boundary
        const words = title.split(/\s+/);
        const truncated = [];
        let length = 0;

        for (const word of words) {
            if (length + word.length + 1 > 80) break;
            truncated.push(word);
            length += word.length + 1;
        }

        title = truncated.join(" ");

        // Move the rest to description
        const remaining = words.slice(truncated.length).join(" ");
        if (remaining) {
            description = remaining + (description ? ". " + description : "");
        }
    }

    // Clean up description
    description = description.trim();

    // Ensure title starts with capital letter
    if (title.length > 0) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    // Ensure description starts with capital letter
    if (description.length > 0) {
        description = description.charAt(0).toUpperCase() + description.slice(1);
    }

    // Remove redundant punctuation
    title = title.replace(/[.!?]+$/, "");

    // Ensure description ends with period if it's a complete sentence
    if (description.length > 10 && !/[.!?]$/.test(description)) {
        description += ".";
    }

    return { title, description };
}

/**
 * Validate if a parsed result makes sense
 */
export function validateParsedResult(result: ParsedTranscription): boolean {
    const { title, description } = result;

    // Title should exist and be reasonable length
    if (!title || title.length < 2 || title.length > 150) {
        return false;
    }

    // Description can be empty, but if it exists, should be meaningful
    if (description && description.length < 5) {
        return false;
    }

    // Title shouldn't be just numbers or special characters
    if (!/[a-zA-Z]/.test(title)) {
        return false;
    }

    return true;
}

/**
 * Get suggestions for improving transcription parsing
 */
export function getParsingTips(): string[] {
    return [
        "Speak clearly and at a moderate pace",
        "Use natural pauses between the title and description",
        "Start with action words like 'Create', 'Fix', 'Update', etc.",
        "Be specific about what needs to be done",
        "Include context and requirements in the description",
        "Use punctuation words like 'period' or 'comma' if needed",
    ];
}
