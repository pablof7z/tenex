// Common transcription corrections for voice-to-text
// These corrections help fix common misinterpretations by speech recognition

export const corrections = {
    // Nostr-specific corrections
    nostur: "nostr",
    noster: "nostr",
    nostril: "nostr",
    "noster protocol": "nostr protocol",
    "nostur protocol": "nostr protocol",
    "nostril protocol": "nostr protocol",

    // Technical terms
    API: "API",
    api: "API",
    JSON: "JSON",
    jason: "JSON",
    "jay son": "JSON",
    HTTP: "HTTP",
    HTTPS: "HTTPS",
    URL: "URL",
    "you are el": "URL",
    earl: "URL",

    // Programming terms
    javascript: "JavaScript",
    "java script": "JavaScript",
    typescript: "TypeScript",
    "type script": "TypeScript",
    react: "React",
    "node js": "Node.js",
    nodejs: "Node.js",
    npm: "npm",
    github: "GitHub",
    "git hub": "GitHub",

    // Common words that get misheard
    their: "there",
    there: "their", // Context dependent - this is a simple example
    to: "too",
    too: "to",
    your: "you're",
    youre: "you're",

    // Task-related terms
    todo: "to-do",
    "to do": "to-do",
    task: "task",
    tasks: "tasks",
    project: "project",
    projects: "projects",
    feature: "feature",
    features: "features",
    bug: "bug",
    bugs: "bugs",
    issue: "issue",
    issues: "issues",

    // Common filler words to remove or replace
    um: "",
    uh: "",
    like: "",
    "you know": "",
    basically: "",
    actually: "",

    // Punctuation fixes
    period: ".",
    comma: ",",
    "question mark": "?",
    "exclamation point": "!",
    colon: ":",
    semicolon: ";",

    // Numbers
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",

    // Time-related
    today: "today",
    tomorrow: "tomorrow",
    yesterday: "yesterday",
    "this week": "this week",
    "next week": "next week",
    "this month": "this month",
    "next month": "next month",
};

// Regex patterns for more complex corrections
export const regexCorrections = [
    // Fix multiple spaces
    {
        pattern: /\s+/g,
        replacement: " ",
    },

    // Fix spacing around punctuation
    {
        pattern: /\s+([,.!?;:])/g,
        replacement: "$1",
    },

    // Capitalize first letter of sentences
    {
        pattern: /([.!?]\s*)([a-z])/g,
        replacement: "$1$2".toUpperCase(),
    },

    // Fix "I" capitalization
    {
        pattern: /\bi\b/g,
        replacement: "I",
    },

    // Remove extra punctuation
    {
        pattern: /([.!?]){2,}/g,
        replacement: "$1",
    },

    // Fix common contractions
    {
        pattern: /\bwont\b/g,
        replacement: "won't",
    },
    {
        pattern: /\bcant\b/g,
        replacement: "can't",
    },
    {
        pattern: /\bdont\b/g,
        replacement: "don't",
    },
    {
        pattern: /\bisnt\b/g,
        replacement: "isn't",
    },
    {
        pattern: /\barent\b/g,
        replacement: "aren't",
    },
    {
        pattern: /\bwasnt\b/g,
        replacement: "wasn't",
    },
    {
        pattern: /\bwerent\b/g,
        replacement: "weren't",
    },
    {
        pattern: /\bhavent\b/g,
        replacement: "haven't",
    },
    {
        pattern: /\bhasnt\b/g,
        replacement: "hasn't",
    },
    {
        pattern: /\bhadnt\b/g,
        replacement: "hadn't",
    },
    {
        pattern: /\bwont\b/g,
        replacement: "won't",
    },
    {
        pattern: /\bwouldnt\b/g,
        replacement: "wouldn't",
    },
    {
        pattern: /\bcouldnt\b/g,
        replacement: "couldn't",
    },
    {
        pattern: /\bshouldnt\b/g,
        replacement: "shouldn't",
    },
];

// Context-aware corrections (more advanced)
export const contextCorrections = {
    // When talking about development
    development: {
        code: "code",
        coding: "coding",
        program: "program",
        programming: "programming",
        develop: "develop",
        development: "development",
        developer: "developer",
        software: "software",
        application: "application",
        app: "app",
        website: "website",
        "web site": "website",
        frontend: "frontend",
        "front end": "frontend",
        backend: "backend",
        "back end": "backend",
        database: "database",
        "data base": "database",
        server: "server",
        client: "client",
    },

    // When talking about tasks/projects
    project: {
        milestone: "milestone",
        deadline: "deadline",
        priority: "priority",
        urgent: "urgent",
        important: "important",
        complete: "complete",
        completed: "completed",
        finish: "finish",
        finished: "finished",
        start: "start",
        started: "started",
        begin: "begin",
        beginning: "beginning",
    },
};
