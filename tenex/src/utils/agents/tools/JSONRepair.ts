import { logger } from "@tenex/shared/logger";

const jsonRepairLogger = logger.forModule("json-repair");

export interface JSONRepairOptions {
    attemptAutoFix?: boolean;
    maxRetries?: number;
}

export class JSONRepairError extends Error {
    constructor(
        message: string,
        public readonly originalError: Error,
        public readonly repairAttempts: string[]
    ) {
        super(message);
        this.name = "JSONRepairError";
    }
}

/**
 * Attempts to repair common JSON formatting issues
 */
export class JSONRepair {
    /**
     * Try to repair and parse JSON content
     */
    static parse(content: string, options: JSONRepairOptions = {}): any {
        const { attemptAutoFix = true, maxRetries = 3 } = options;
        const repairAttempts: string[] = [];

        // First, try to parse as-is
        try {
            return JSON.parse(content);
        } catch (originalError) {
            if (!attemptAutoFix) {
                throw originalError;
            }

            jsonRepairLogger.debug("Initial JSON parse failed, attempting repairs");
            
            // Track the original error
            repairAttempts.push(`Original error: ${originalError}`);

            // Try various repair strategies
            let repairedContent = content;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // Apply repair strategies based on the error and content analysis
                    repairedContent = this.applyRepairStrategies(repairedContent, originalError as Error, repairAttempts);
                    
                    // Try to parse the repaired content
                    const result = JSON.parse(repairedContent);
                    jsonRepairLogger.info(`JSON successfully repaired after ${attempt + 1} attempts`);
                    return result;
                } catch (repairError) {
                    repairAttempts.push(`Repair attempt ${attempt + 1} failed: ${repairError}`);
                    jsonRepairLogger.debug(`Repair attempt ${attempt + 1} failed: ${repairError}`);
                }
            }

            // If all repairs failed, throw a detailed error
            throw new JSONRepairError(
                "Failed to repair JSON after all attempts",
                originalError as Error,
                repairAttempts
            );
        }
    }

    /**
     * Apply various repair strategies based on error analysis
     */
    private static applyRepairStrategies(content: string, error: Error, attempts: string[]): string {
        let repaired = content;

        // Strategy 0: Extract JSON from markdown code blocks first
        const extracted = this.extractJSONFromMarkdown(repaired);
        if (extracted !== repaired) {
            attempts.push("Extracted JSON from markdown code block");
            repaired = extracted;
        }

        // Strategy 1: Fix malformed object/array closures (like the error case)
        if (this.hasMalformedClosures(repaired)) {
            attempts.push("Fixing malformed object/array closures");
            repaired = this.fixMalformedClosures(repaired);
        }

        // Strategy 2: Fix unterminated strings
        if (error.message.includes("Unterminated string")) {
            attempts.push("Applying unterminated string fix");
            repaired = this.fixUnterminatedStrings(repaired);
        }

        // Strategy 3: Fix trailing commas
        if (error.message.includes("trailing comma") || this.hasTrailingComma(repaired)) {
            attempts.push("Removing trailing commas");
            repaired = this.removeTrailingCommas(repaired);
        }

        // Strategy 4: Fix missing quotes around keys
        if (error.message.includes("Expected property name")) {
            attempts.push("Adding quotes to unquoted keys");
            repaired = this.fixUnquotedKeys(repaired);
        }

        // Strategy 5: Fix incomplete JSON structure
        if (this.isIncompleteJSON(repaired)) {
            attempts.push("Fixing incomplete JSON structure");
            repaired = this.completeJSONStructure(repaired);
        }

        // Strategy 6: Remove comments
        if (this.hasComments(repaired)) {
            attempts.push("Removing comments");
            repaired = this.removeComments(repaired);
        }

        // Strategy 7: Fix single quotes
        if (this.hasSingleQuotes(repaired)) {
            attempts.push("Converting single quotes to double quotes");
            repaired = this.fixSingleQuotes(repaired);
        }

        return repaired;
    }

    /**
     * Fix unterminated strings by closing them properly
     */
    private static fixUnterminatedStrings(content: string): string {
        // More sophisticated approach to handle complex cases
        let result = '';
        let inString = false;
        let stringChar: string | null = null;
        let escapeNext = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = i < content.length - 1 ? content[i + 1] : '';
            
            if (escapeNext) {
                result += char;
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                result += char;
                escapeNext = true;
                continue;
            }
            
            if ((char === '"' || char === "'") && !inString) {
                // Starting a string
                inString = true;
                stringChar = char;
                result += char;
            } else if (inString && char === stringChar) {
                // Ending a string
                inString = false;
                stringChar = null;
                result += char;
            } else if (inString && char === '\n') {
                // Found newline in string, close the string first
                result += stringChar + char;
                inString = false;
                stringChar = null;
            } else {
                result += char;
            }
        }
        
        // If we're still in a string at the end, close it
        if (inString && stringChar) {
            result += stringChar;
        }
        
        return result;
    }

    /**
     * Remove trailing commas from objects and arrays
     */
    private static removeTrailingCommas(content: string): string {
        // Remove trailing commas before closing braces or brackets
        return content
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
    }

    /**
     * Add quotes to unquoted object keys
     */
    private static fixUnquotedKeys(content: string): string {
        // Match unquoted keys (word characters followed by colon)
        return content.replace(/(\w+):/g, '"$1":');
    }

    /**
     * Complete incomplete JSON structures
     */
    private static completeJSONStructure(content: string): string {
        let openBraces = 0;
        let openBrackets = 0;
        let inString = false;
        let stringChar: string | null = null;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const prevChar = i > 0 ? content[i - 1] : '';

            // Track string boundaries
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                    stringChar = null;
                }
            }

            // Count braces and brackets outside of strings
            if (!inString) {
                if (char === '{') openBraces++;
                else if (char === '}') openBraces--;
                else if (char === '[') openBrackets++;
                else if (char === ']') openBrackets--;
            }
        }

        // Close any open strings first
        if (inString && stringChar) {
            content += stringChar;
        }

        // Add missing closing brackets/braces
        while (openBrackets > 0) {
            content += ']';
            openBrackets--;
        }
        while (openBraces > 0) {
            content += '}';
            openBraces--;
        }

        return content;
    }

    /**
     * Remove JavaScript-style comments
     */
    private static removeComments(content: string): string {
        // Remove single-line comments
        content = content.replace(/\/\/.*$/gm, '');
        
        // Remove multi-line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        
        return content;
    }

    /**
     * Convert single quotes to double quotes (except within strings)
     */
    private static fixSingleQuotes(content: string): string {
        let result = '';
        let inDoubleQuoteString = false;
        let inSingleQuoteString = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const prevChar = i > 0 ? content[i - 1] : '';
            
            if (char === '"' && prevChar !== '\\' && !inSingleQuoteString) {
                inDoubleQuoteString = !inDoubleQuoteString;
                result += char;
            } else if (char === "'" && prevChar !== '\\' && !inDoubleQuoteString) {
                if (!inSingleQuoteString) {
                    inSingleQuoteString = true;
                    result += '"'; // Convert opening single quote to double
                } else {
                    inSingleQuoteString = false;
                    result += '"'; // Convert closing single quote to double
                }
            } else {
                result += char;
            }
        }
        
        return result;
    }

    /**
     * Extract JSON from markdown code blocks
     */
    private static extractJSONFromMarkdown(content: string): string {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            return jsonMatch[1];
        }
        
        // Try to extract any code block
        const codeMatch = content.match(/```\n?([\s\S]*?)\n?```/);
        if (codeMatch) {
            return codeMatch[1];
        }
        
        return content;
    }

    /**
     * Check if content has trailing commas
     */
    private static hasTrailingComma(content: string): boolean {
        return /,\s*[}\]]/.test(content);
    }

    /**
     * Check if JSON structure is incomplete
     */
    private static isIncompleteJSON(content: string): boolean {
        let openBraces = 0;
        let openBrackets = 0;
        let inString = false;
        let stringChar: string | null = null;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const prevChar = i > 0 ? content[i - 1] : '';

            if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                    stringChar = null;
                }
            }

            if (!inString) {
                if (char === '{') openBraces++;
                else if (char === '}') openBraces--;
                else if (char === '[') openBrackets++;
                else if (char === ']') openBrackets--;
            }
        }

        return openBraces !== 0 || openBrackets !== 0 || inString;
    }

    /**
     * Check if content has comments
     */
    private static hasComments(content: string): boolean {
        return /\/\/.*$|\/\*[\s\S]*?\*\//m.test(content);
    }

    /**
     * Check if content has single quotes used for strings
     */
    private static hasSingleQuotes(content: string): boolean {
        // Simple check - could be improved
        return /'[^']*'/.test(content);
    }

    /**
     * Check if content has malformed closures like `}"`
     */
    private static hasMalformedClosures(content: string): boolean {
        return /[}\]]\s*"[^:]/g.test(content);
    }

    /**
     * Fix malformed closures like `} "` by adding missing commas
     */
    private static fixMalformedClosures(content: string): string {
        // The specific case we're fixing is `} ",` which should be `},`
        // This happens when there's a quote after a closing brace/bracket
        return content
            .replace(/}\s*",/g, '},')
            .replace(/]\s*",/g, '],')
            .replace(/}\s*"\s*,/g, '},')
            .replace(/]\s*"\s*,/g, '],');
    }
}