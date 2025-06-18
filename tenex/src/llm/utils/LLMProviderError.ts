export class LLMProviderError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly statusCode?: number,
        public readonly originalError?: unknown,
        public readonly context?: {
            agent?: string;
            project?: string;
            conversation?: string;
            model?: string;
        }
    ) {
        super(message);
        this.name = "LLMProviderError";
    }
}

export class LLMValidationError extends LLMProviderError {
    constructor(
        message: string,
        provider: string,
        public readonly field?: string
    ) {
        super(message, provider);
        this.name = "LLMValidationError";
    }
}

export class LLMRateLimitError extends LLMProviderError {
    constructor(
        message: string,
        provider: string,
        public readonly retryAfter?: number
    ) {
        super(message, provider, 429);
        this.name = "LLMRateLimitError";
    }
}

export class LLMAuthenticationError extends LLMProviderError {
    constructor(message: string, provider: string) {
        super(message, provider, 401);
        this.name = "LLMAuthenticationError";
    }
}
