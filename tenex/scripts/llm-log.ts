#!/usr/bin/env bun

import { promises as fs } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import readline from "readline";
import type { LLMCallLogEntry } from "../src/llm/callLogger";

// Check if running in interactive mode
const isInteractive = process.stdout.isTTY && !process.env.CI && !process.argv.includes('--no-interactive');

if (isInteractive) {
    // Use the new tree viewer for interactive mode
    import('./llm-log-tree.ts').then(() => {
        // Tree viewer handles everything
    }).catch(error => {
        console.error(chalk.red('Failed to load tree viewer, falling back to simple viewer'), error);
        runInteractiveMode().catch(console.error);
    });
} else {
    // Run static viewer
    runStaticViewer().catch(console.error);
}

// Enable raw mode for keyboard input
function enableRawMode() {
    if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
    }
}

// Verbosity levels
enum VerbosityLevel {
    COLLAPSED = 0,
    MESSAGES = 1,
    SYSTEM = 2,
    FULL = 3,
}

// Search result
interface SearchResult {
    entryIndex: number;
    messageIndex: number;
    preview: string;
    matchStart: number;
    matchEnd: number;
}

// Navigation state
interface NavigationState {
    currentEntry: number;
    verbosity: VerbosityLevel;
    entries: LLMCallLogEntry[];
    searchMode: boolean;
    searchQuery: string;
    searchResults: SearchResult[];
    currentSearchResult: number;
}

// Clear screen
function clearScreen() {
    process.stdout.write('\x1B[2J\x1B[H');
}

// Format markdown
function formatMarkdown(text: string): string {
    return text
        .replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => chalk.bold.blue(`${hashes} ${content}`))
        .replace(/\*\*([^*]+)\*\*/g, chalk.bold('$1'))
        .replace(/\*([^*]+)\*/g, chalk.italic('$1'))
        .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
            return chalk.gray('```' + (lang || '')) + '\n' + chalk.green(code) + chalk.gray('```');
        })
        .replace(/`([^`]+)`/g, chalk.yellow('`$1`'))
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, chalk.cyan('[$1]') + chalk.gray('($2)'))
        .replace(/^(\s*)([-*+])\s+(.+)$/gm, (_, spaces, bullet, content) => `${spaces}${chalk.yellow(bullet)} ${content}`)
        .replace(/^(\s*)(\d+\.)\s+(.+)$/gm, (_, spaces, num, content) => `${spaces}${chalk.yellow(num)} ${content}`);
}

// Format JSON
function colorizeJSON(json: string): string {
    return json
        .replace(/"([^"]+)":/g, chalk.cyan('"$1":'))
        .replace(/: "([^"]+)"/g, ': ' + chalk.green('"$1"'))
        .replace(/: (\d+)/g, ': ' + chalk.yellow('$1'))
        .replace(/: (true|false)/g, ': ' + chalk.magenta('$1'))
        .replace(/: null/g, ': ' + chalk.gray('null'));
}

// Format content with enhancements
function formatContentWithEnhancements(content: string, isSystemPrompt: boolean = false): string {
    content = content.replace(/\\n/g, '\n');
    
    if (isSystemPrompt) {
        content = formatMarkdown(content);
    }
    
    // Handle <tool_use> blocks
    content = content.replace(/<tool_use>([\s\S]*?)<\/tool_use>/g, (match, jsonContent) => {
        try {
            const parsed = JSON.parse(jsonContent.trim());
            const formatted = JSON.stringify(parsed, null, 2);
            return chalk.gray('<tool_use>\n') + colorizeJSON(formatted) + chalk.gray('\n</tool_use>');
        } catch {
            return chalk.gray('<tool_use>') + jsonContent + chalk.gray('</tool_use>');
        }
    });
    
    return content;
}

// Get message summary (multi-line allowed)
function getMessageSummary(msg: any, maxLines: number = 5): string {
    const lines = msg.content.trim().split('\n');
    if (lines.length <= maxLines) {
        return msg.content.trim();
    }
    return lines.slice(0, maxLines).join('\n') + '\n' + chalk.gray('...');
}

// Format entry based on verbosity
function formatEntry(entry: LLMCallLogEntry, verbosity: VerbosityLevel, isSelected: boolean = false): string[] {
    const lines: string[] = [];
    
    const statusIcon = entry.status === 'success' ? '✅' : '❌';
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const header = `${statusIcon} ${timestamp} - ${entry.configKey} (${entry.config.provider}/${entry.config.model})`;
    
    // Highlight selected entry
    if (isSelected) {
        lines.push(chalk.inverse.bold(` ▶ ${header} `));
        lines.push(chalk.blue('─'.repeat(80)));
    } else {
        lines.push(chalk.bold(header));
        lines.push(chalk.gray('─'.repeat(80)));
    }
    
    lines.push(`${chalk.bold('Duration:')} ${formatDuration(entry.durationMs || 0)} | ${chalk.bold('Agent:')} ${entry.agentName || 'N/A'}`);
    
    if (verbosity === VerbosityLevel.COLLAPSED) {
        lines.push(`${chalk.bold('Messages:')} ${entry.request.messageCount} | ${chalk.bold('Total Size:')} ${formatBytes(entry.request.totalRequestLength)}`);
        
        if (entry.request.systemPrompt) {
            lines.push(`${chalk.bold('System Prompt:')} ${formatBytes(entry.request.systemPrompt.length)}`);
        }
        
        const lastUserMsg = [...entry.request.messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            lines.push('');
            lines.push(chalk.bold('Last Message:'));
            const userSummary = getMessageSummary(lastUserMsg);
            userSummary.split('\n').forEach(line => lines.push(`  ${chalk.green(line)}`));
        }
        
        if (entry.response) {
            if (entry.response.content) {
                lines.push('');
                lines.push(chalk.bold('Response:'));
                const responseSummary = getMessageSummary({ content: entry.response.content });
                responseSummary.split('\n').forEach(line => lines.push(`  ${chalk.magenta(line)}`));
            }
            if (entry.response.toolCalls && entry.response.toolCalls.length > 0) {
                const toolNames = entry.response.toolCalls.map(tc => tc.name).join(', ');
                lines.push(`${chalk.bold('Tools:')} ${chalk.cyan(toolNames)}`);
            }
        }
        
        if (entry.error) {
            lines.push(`${chalk.bold.red('Error:')} ${entry.error.message}`);
        }
    } else {
        // Expanded views - implementation continues in formatEntry function
        lines.push(...formatExpandedEntry(entry, verbosity));
    }
    
    return lines;
}

// Format expanded entry (helper function)
function formatExpandedEntry(entry: LLMCallLogEntry, verbosity: VerbosityLevel): string[] {
    const lines: string[] = [];
    
    lines.push('');
    lines.push(chalk.bold.yellow('📤 REQUEST'));
    
    if (entry.request.systemPrompt && verbosity >= VerbosityLevel.SYSTEM) {
        lines.push(`${chalk.bold('System Prompt:')} ${chalk.gray(`(${formatBytes(entry.request.systemPrompt.length)})`)}`);;
        const formatted = formatContentWithEnhancements(entry.request.systemPrompt.content, true);
        formatted.split('\n').forEach(line => lines.push(`  ${line}`));
        lines.push('');
    } else if (entry.request.systemPrompt) {
        lines.push(`${chalk.bold('System Prompt:')} ${chalk.gray(`[${formatBytes(entry.request.systemPrompt.length)} - press → to expand]`)}`);
        lines.push('');
    }
    
    if (verbosity >= VerbosityLevel.MESSAGES) {
        lines.push(chalk.bold('Messages:'));
        entry.request.messages.forEach((msg, idx) => {
            const roleColor = msg.role === 'system' ? chalk.blue :
                             msg.role === 'user' ? chalk.green :
                             msg.role === 'assistant' ? chalk.magenta :
                             chalk.white;
            
            lines.push(`  ${chalk.gray(`[${idx}]`)} ${roleColor(msg.role.toUpperCase())} ${chalk.gray(`(${formatBytes(msg.contentLength)})`)}`);;
            
            if (verbosity >= VerbosityLevel.FULL || msg.role !== 'system') {
                const formatted = formatContentWithEnhancements(msg.content, msg.role === 'system');
                formatted.split('\n').forEach(line => lines.push(`    ${line}`));
            } else {
                lines.push(`    ${chalk.gray('[content hidden - press → to expand]')}`);
            }
            lines.push('');
        });
    } else {
        lines.push(`${chalk.bold('Messages:')} ${entry.request.messageCount} ${chalk.gray('[press → to expand]')}`);
    }
    
    if (entry.response) {
        lines.push(chalk.bold.green('📥 RESPONSE'));
        
        if (entry.response.content) {
            lines.push(`${chalk.bold('Content:')} ${chalk.gray(`(${formatBytes(entry.response.contentLength || 0)})`)}`);;
            if (verbosity >= VerbosityLevel.MESSAGES) {
                const formatted = formatContentWithEnhancements(entry.response.content);
                formatted.split('\n').forEach(line => lines.push(`  ${line}`));
            } else {
                lines.push(`  ${chalk.magenta(getMessageSummary({ content: entry.response.content }))}`);
            }
        }
    }
    
    return lines;
}

// Perform search across all entries
function performSearch(entries: LLMCallLogEntry[], query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    
    entries.forEach((entry, entryIndex) => {
        // Search in request messages
        entry.request.messages.forEach((msg, msgIndex) => {
            const content = msg.content.toLowerCase();
            const index = content.indexOf(lowerQuery);
            if (index !== -1) {
                const start = Math.max(0, index - 40);
                const end = Math.min(content.length, index + lowerQuery.length + 40);
                const preview = msg.content.substring(start, end).replace(/\n/g, ' ');
                results.push({
                    entryIndex,
                    messageIndex: msgIndex,
                    preview: (start > 0 ? '...' : '') + preview + (end < content.length ? '...' : ''),
                    matchStart: start > 0 ? index - start + 3 : index - start,
                    matchEnd: start > 0 ? index - start + 3 + lowerQuery.length : index - start + lowerQuery.length
                });
            }
        });
        
        // Search in response content
        if (entry.response?.content) {
            const content = entry.response.content.toLowerCase();
            const index = content.indexOf(lowerQuery);
            if (index !== -1) {
                const start = Math.max(0, index - 40);
                const end = Math.min(content.length, index + lowerQuery.length + 40);
                const preview = entry.response.content.substring(start, end).replace(/\n/g, ' ');
                results.push({
                    entryIndex,
                    messageIndex: -1, // -1 indicates response
                    preview: (start > 0 ? '...' : '') + preview + (end < content.length ? '...' : ''),
                    matchStart: start > 0 ? index - start + 3 : index - start,
                    matchEnd: start > 0 ? index - start + 3 + lowerQuery.length : index - start + lowerQuery.length
                });
            }
        }
    });
    
    return results;
}

// Display search results
function displaySearchResults(state: NavigationState) {
    clearScreen();
    
    console.log(chalk.bold.yellow('🔍 Live Search'));
    console.log(chalk.gray(`Query: "${state.searchQuery}" | ${state.searchResults.length} matches found`));
    console.log(chalk.gray('Type to search | ↑/↓ to navigate | Enter to jump | Esc to exit'));
    console.log(chalk.gray('═'.repeat(80)));
    console.log('');
    
    if (state.searchResults.length === 0) {
        console.log(chalk.gray('No matches found'));
    } else {
        // Show max 10 results to keep display manageable
        const maxResults = 10;
        const startIndex = Math.max(0, Math.min(state.currentSearchResult - 3, state.searchResults.length - maxResults));
        const endIndex = Math.min(startIndex + maxResults, state.searchResults.length);
        
        if (startIndex > 0) {
            console.log(chalk.gray(`  ... ${startIndex} more results above ...`));
            console.log('');
        }
        
        state.searchResults.slice(startIndex, endIndex).forEach((result, relativeIndex) => {
            const index = startIndex + relativeIndex;
            const isSelected = index === state.currentSearchResult;
            const entry = state.entries[result.entryIndex];
            const timestamp = new Date(entry.timestamp).toLocaleString();
            const messageType = result.messageIndex === -1 ? 'Response' : 
                               entry.request.messages[result.messageIndex].role;
            
            // Highlight the match in preview
            const preview = result.preview;
            const beforeMatch = preview.substring(0, result.matchStart);
            const match = preview.substring(result.matchStart, result.matchEnd);
            const afterMatch = preview.substring(result.matchEnd);
            
            const formattedPreview = beforeMatch + chalk.yellow.bold(match) + afterMatch;
            
            if (isSelected) {
                console.log(chalk.inverse(`▶ Entry ${result.entryIndex + 1} - ${messageType} - ${timestamp}`));
                console.log(chalk.inverse(`  ${formattedPreview}`));
            } else {
                console.log(chalk.gray(`  Entry ${result.entryIndex + 1} - ${messageType} - ${timestamp}`));
                console.log(`  ${formattedPreview}`);
            }
            console.log('');
        });
        
        if (endIndex < state.searchResults.length) {
            console.log(chalk.gray(`  ... ${state.searchResults.length - endIndex} more results below ...`));
        }
    }
    
    console.log(chalk.gray('═'.repeat(80)));
}

// Get terminal height
function getTerminalHeight(): number {
    return process.stdout.rows || 30; // Default to 30 if not available
}

// Display current state
function display(state: NavigationState) {
    if (state.searchMode && state.searchResults.length > 0) {
        displaySearchResults(state);
        return;
    }
    
    clearScreen();
    
    const terminalHeight = getTerminalHeight();
    const headerHeight = 5; // Header lines
    const footerHeight = 3; // Footer lines
    const availableHeight = terminalHeight - headerHeight - footerHeight;
    
    console.log(chalk.bold.blue('🔍 LLM Log Viewer'));
    console.log(chalk.gray(`Showing entries starting from ${state.currentEntry + 1} of ${state.entries.length} | Verbosity: ${VerbosityLevel[state.verbosity]}`));
    console.log(chalk.gray('Use ↑/↓ to navigate, ←/→ to change verbosity, / to search, q to quit'));
    console.log(chalk.gray('═'.repeat(80)));
    console.log('');
    
    let currentHeight = 0;
    let entriesShown = 0;
    
    // Calculate the start index to ensure selected entry is visible
    let startIndex = state.currentEntry;
    
    // If possible, show some context before the selected entry
    const contextBefore = 2; // Show 2 entries before selected if possible
    startIndex = Math.max(0, state.currentEntry - contextBefore);
    
    // Make sure we show as many entries as possible
    let testHeight = 0;
    let testIndex = startIndex;
    const entryHeights: number[] = [];
    
    // Calculate heights for entries starting from our start position
    while (testIndex < state.entries.length && testHeight < availableHeight) {
        const entry = state.entries[testIndex];
        const isSelected = testIndex === state.currentEntry;
        const entryLines = formatEntry(entry, state.verbosity, isSelected);
        const entryHeight = entryLines.length + (testIndex > startIndex ? 3 : 0); // Include separator
        
        if (testHeight + entryHeight <= availableHeight || testIndex === state.currentEntry) {
            entryHeights.push(entryHeight);
            testHeight += entryHeight;
            testIndex++;
        } else {
            break;
        }
    }
    
    // If selected entry is not visible, adjust start index
    if (state.currentEntry >= testIndex) {
        startIndex = state.currentEntry;
        entryHeights.length = 0; // Clear and recalculate
    }
    
    let entryIndex = startIndex;
    
    // Show as many entries as fit on screen
    while (entryIndex < state.entries.length && currentHeight < availableHeight) {
        const entry = state.entries[entryIndex];
        const isSelected = entryIndex === state.currentEntry;
        const entryLines = formatEntry(entry, state.verbosity, isSelected);
        
        // Check if this entry would fit
        if (currentHeight + entryLines.length + 2 > availableHeight && entriesShown > 0) {
            // Don't show partial entries (unless it's the only one)
            break;
        }
        
        // Show separator between entries (except for the first one)
        if (entriesShown > 0) {
            console.log('');
            console.log(chalk.gray('─'.repeat(80)));
            console.log('');
            currentHeight += 3;
        }
        
        // Show the entry
        entryLines.forEach(line => console.log(line));
        currentHeight += entryLines.length;
        entriesShown++;
        entryIndex++;
    }
    
    // Fill remaining space to keep footer at bottom
    while (currentHeight < availableHeight) {
        console.log('');
        currentHeight++;
    }
    
    console.log(chalk.gray('═'.repeat(80)));
    if (startIndex > 0 || entryIndex < state.entries.length) {
        const moreAbove = startIndex > 0 ? `↑ ${startIndex} more` : '';
        const moreBelow = entryIndex < state.entries.length ? `↓ ${state.entries.length - entryIndex} more` : '';
        const separator = moreAbove && moreBelow ? ' | ' : '';
        console.log(chalk.gray(`${moreAbove}${separator}${moreBelow} | ← Less detail | → More detail | / Search | q Quit`));
    } else {
        console.log(chalk.gray(`← Less detail | → More detail | ↑ Previous | ↓ Next | / Search | q Quit`));
    }
}

// Run interactive mode
async function runInteractiveMode() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error(chalk.red('❌ Usage: bun run llm-log <path-to-file>.jsonl'));
        process.exit(1);
    }
    
    try {
        const resolvedPath = resolve(filePath);
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const entries: LLMCallLogEntry[] = [];
        
        for (const line of lines) {
            try {
                entries.push(JSON.parse(line));
            } catch {
                // Skip invalid lines
            }
        }
        
        if (entries.length === 0) {
            console.error(chalk.red('❌ No valid log entries found'));
            process.exit(1);
        }
        
        const state: NavigationState = {
            currentEntry: 0,
            verbosity: VerbosityLevel.COLLAPSED,
            entries,
            searchMode: false,
            searchQuery: '',
            searchResults: [],
            currentSearchResult: 0
        };
        
        enableRawMode();
        display(state);
        
        let searchBuffer = '';
        let isTypingSearch = false;
        
        // Helper to update search results while typing
        function updateSearchWhileTyping() {
            if (searchBuffer.trim()) {
                state.searchQuery = searchBuffer.trim();
                state.searchResults = performSearch(state.entries, state.searchQuery);
                state.currentSearchResult = 0;
                state.searchMode = true;
                display(state);
                // Show search prompt at bottom
                process.stdout.write('\n' + chalk.gray('Search: ') + chalk.yellow(searchBuffer));
            } else {
                state.searchMode = false;
                display(state);
                process.stdout.write('\n' + chalk.gray('Search: ') + searchBuffer);
            }
        }
        
        process.stdin.on('keypress', (str, key) => {
            if (!key) return;
            
            // Handle search typing mode
            if (isTypingSearch) {
                if (key.name === 'escape') {
                    // Cancel search
                    isTypingSearch = false;
                    searchBuffer = '';
                    state.searchMode = false;
                    display(state);
                } else if (key.name === 'return' && state.searchResults.length > 0) {
                    // Jump to selected result
                    const result = state.searchResults[state.currentSearchResult];
                    state.currentEntry = result.entryIndex;
                    state.searchMode = false;
                    isTypingSearch = false;
                    searchBuffer = '';
                    display(state);
                } else if (key.name === 'up' && state.currentSearchResult > 0) {
                    // Navigate search results while typing
                    state.currentSearchResult--;
                    display(state);
                    process.stdout.write('\n' + chalk.gray('Search: ') + chalk.yellow(searchBuffer));
                } else if (key.name === 'down' && state.currentSearchResult < state.searchResults.length - 1) {
                    // Navigate search results while typing
                    state.currentSearchResult++;
                    display(state);
                    process.stdout.write('\n' + chalk.gray('Search: ') + chalk.yellow(searchBuffer));
                } else if (key.name === 'backspace') {
                    searchBuffer = searchBuffer.slice(0, -1);
                    updateSearchWhileTyping();
                } else if (str && str.length === 1 && !key.ctrl) {
                    searchBuffer += str;
                    updateSearchWhileTyping();
                }
                return;
            }
            
            
            // Normal navigation
            if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                clearScreen();
                process.exit(0);
            } else if (key.name === 'up' && state.currentEntry > 0) {
                state.currentEntry--;
                display(state);
            } else if (key.name === 'down' && state.currentEntry < state.entries.length - 1) {
                state.currentEntry++;
                display(state);
            } else if (key.name === 'pageup') {
                // Scroll up by screen height
                const pageSize = Math.max(1, Math.floor((getTerminalHeight() - 8) / 10)); // Rough estimate
                state.currentEntry = Math.max(0, state.currentEntry - pageSize);
                display(state);
            } else if (key.name === 'pagedown') {
                // Scroll down by screen height
                const pageSize = Math.max(1, Math.floor((getTerminalHeight() - 8) / 10)); // Rough estimate
                state.currentEntry = Math.min(state.entries.length - 1, state.currentEntry + pageSize);
                display(state);
            } else if (key.name === 'left' && state.verbosity > VerbosityLevel.COLLAPSED) {
                state.verbosity--;
                display(state);
            } else if (key.name === 'right' && state.verbosity < VerbosityLevel.FULL) {
                state.verbosity++;
                display(state);
            } else if (key.name === 'home') {
                state.currentEntry = 0;
                display(state);
            } else if (key.name === 'end') {
                state.currentEntry = state.entries.length - 1;
                display(state);
            } else if (str === '/') {
                // Enter search mode
                isTypingSearch = true;
                searchBuffer = '';
                process.stdout.write('\n' + chalk.gray('Search: '));
            }
        });
        
        process.stdin.resume();
        
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error);
        process.exit(1);
    }
}

// Format bytes helper
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Format duration helper
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

async function runStaticViewer() {

// JSON detection regex
const JSON_REGEX = /(\{[\s\S]*\}|\[[\s\S]*\])/;

// Format bytes to human readable
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Format duration
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

// Detect and format JSON in text
function formatContentWithJSON(content: string): string {
    // First, replace escaped newlines with actual newlines
    content = content.replace(/\\n/g, '\n');
    
    // Try to detect JSON blocks
    const lines = content.split('\n');
    const formattedLines: string[] = [];
    
    let inJsonBlock = false;
    let jsonBuffer = '';
    
    for (const line of lines) {
        // Check if line starts a JSON block
        if ((line.includes('{') || line.includes('[')) && !inJsonBlock) {
            const match = line.match(/^(.*?)(\{|\[)/);
            if (match) {
                // Add any text before JSON
                if (match[1]) {
                    formattedLines.push(match[1]);
                }
                inJsonBlock = true;
                jsonBuffer = line.substring(match[1].length);
                continue;
            }
        }
        
        if (inJsonBlock) {
            jsonBuffer += '\n' + line;
            
            // Try to parse accumulated JSON
            try {
                const parsed = JSON.parse(jsonBuffer);
                // Success! Format and colorize the JSON
                const formatted = JSON.stringify(parsed, null, 2);
                const colorized = formatted
                    .replace(/"([^"]+)":/g, chalk.cyan('"$1":')) // Keys
                    .replace(/: "([^"]+)"/g, ': ' + chalk.green('"$1"')) // String values
                    .replace(/: (\d+)/g, ': ' + chalk.yellow('$1')) // Numbers
                    .replace(/: (true|false)/g, ': ' + chalk.magenta('$1')) // Booleans
                    .replace(/: null/g, ': ' + chalk.gray('null')); // Null
                
                formattedLines.push(chalk.gray('```json'));
                formattedLines.push(colorized);
                formattedLines.push(chalk.gray('```'));
                
                inJsonBlock = false;
                jsonBuffer = '';
            } catch {
                // Not valid JSON yet, check if we should give up
                const openBraces = (jsonBuffer.match(/\{/g) || []).length;
                const closeBraces = (jsonBuffer.match(/\}/g) || []).length;
                const openBrackets = (jsonBuffer.match(/\[/g) || []).length;
                const closeBrackets = (jsonBuffer.match(/\]/g) || []).length;
                
                if ((openBraces === closeBraces && openBraces > 0) || 
                    (openBrackets === closeBrackets && openBrackets > 0)) {
                    // Balanced but not valid JSON, give up
                    formattedLines.push(jsonBuffer);
                    inJsonBlock = false;
                    jsonBuffer = '';
                }
            }
        } else {
            formattedLines.push(line);
        }
    }
    
    // Add any remaining buffer
    if (jsonBuffer) {
        formattedLines.push(jsonBuffer);
    }
    
    return formattedLines.join('\n');
}

// Format a message
function formatMessage(msg: any, index: number): string {
    const roleColor = msg.role === 'system' ? chalk.blue :
                     msg.role === 'user' ? chalk.green :
                     msg.role === 'assistant' ? chalk.magenta :
                     chalk.white;
    
    const lines: string[] = [];
    lines.push(`    ${chalk.gray(`[${index}]`)} ${roleColor(msg.role.toUpperCase())} ${chalk.gray(`(${formatBytes(msg.contentLength)})`)}`);
    
    if (msg.content) {
        const formattedContent = formatContentWithJSON(msg.content);
        const contentLines = formattedContent.split('\n');
        contentLines.forEach(line => {
            lines.push(`        ${line}`);
        });
    }
    
    return lines.join('\n');
}

// Format tool call
function formatToolCall(tc: any, index: number): string {
    const lines: string[] = [];
    lines.push(`    ${chalk.gray(`[${index}]`)} ${chalk.cyan(tc.name)} ${chalk.gray(`(${tc.id})`)}`);
    
    if (tc.args && Object.keys(tc.args).length > 0) {
        lines.push(chalk.gray('        Args:'));
        const argsFormatted = JSON.stringify(tc.args, null, 2);
        argsFormatted.split('\n').forEach(line => {
            lines.push(`          ${line}`);
        });
    }
    
    return lines.join('\n');
}

// Format a single log entry
function formatLogEntry(entry: LLMCallLogEntry, index: number): string {
    const lines: string[] = [];
    
    // Header with status indicator
    const statusIcon = entry.status === 'success' ? '✅' : '❌';
    const timestamp = new Date(entry.timestamp).toLocaleString();
    lines.push(chalk.bold(`\n${statusIcon} Entry ${index + 1} - ${timestamp}`));
    lines.push(chalk.gray('─'.repeat(80)));
    
    // Basic info
    lines.push(`${chalk.bold('Request ID:')} ${entry.requestId}`);
    lines.push(`${chalk.bold('Duration:')} ${formatDuration(entry.durationMs || 0)}`);
    lines.push(`${chalk.bold('Config:')} ${entry.configKey} (${entry.config.provider}/${entry.config.model})`);
    
    if (entry.agentName) {
        lines.push(`${chalk.bold('Agent:')} ${entry.agentName}`);
    }
    
    // Request details
    lines.push(`\n${chalk.bold.yellow('📤 REQUEST')}`);
    lines.push(`  ${chalk.bold('Messages:')} ${entry.request.messageCount}`);
    lines.push(`  ${chalk.bold('Total Length:')} ${formatBytes(entry.request.totalRequestLength)}`);
    
    if (entry.request.systemPrompt) {
        lines.push(`\n  ${chalk.bold('System Prompt:')} ${chalk.gray(`(${formatBytes(entry.request.systemPrompt.length)})`)}`);
        const systemContent = formatContentWithJSON(entry.request.systemPrompt.content);
        systemContent.split('\n').forEach(line => {
            lines.push(`    ${line}`);
        });
    }
    
    lines.push(`\n  ${chalk.bold('Messages:')}`);
    entry.request.messages.forEach((msg, idx) => {
        lines.push(formatMessage(msg, idx));
    });
    
    // Response details (if successful)
    if (entry.response) {
        lines.push(`\n${chalk.bold.green('📥 RESPONSE')}`);
        
        if (entry.response.content) {
            lines.push(`  ${chalk.bold('Content:')} ${chalk.gray(`(${formatBytes(entry.response.contentLength || 0)})`)}`);
            const responseContent = formatContentWithJSON(entry.response.content);
            responseContent.split('\n').forEach(line => {
                lines.push(`    ${line}`);
            });
        }
        
        if (entry.response.toolCalls && entry.response.toolCalls.length > 0) {
            lines.push(`\n  ${chalk.bold('Tool Calls:')} ${entry.response.toolCallCount}`);
            entry.response.toolCalls.forEach((tc, idx) => {
                lines.push(formatToolCall(tc, idx));
            });
        }
        
        if (entry.response.usage) {
            lines.push(`\n  ${chalk.bold('Usage:')}`);
            lines.push(`    Prompt Tokens: ${chalk.yellow(entry.response.usage.promptTokens || 0)}`);
            lines.push(`    Completion Tokens: ${chalk.yellow(entry.response.usage.completionTokens || 0)}`);
            lines.push(`    Total Tokens: ${chalk.yellow(entry.response.usage.totalTokens || 0)}`);
            if (entry.response.usage.cost) {
                lines.push(`    Cost: ${chalk.green(`$${entry.response.usage.cost.toFixed(4)}`)}`);
            }
        }
    }
    
    // Error details (if failed)
    if (entry.error) {
        lines.push(`\n${chalk.bold.red('❌ ERROR')}`);
        lines.push(`  ${chalk.bold('Type:')} ${chalk.red(entry.error.type)}`);
        lines.push(`  ${chalk.bold('Message:')} ${chalk.red(entry.error.message)}`);
        if (entry.error.stack) {
            lines.push(`  ${chalk.bold('Stack:')}`);
            entry.error.stack.split('\n').forEach(line => {
                lines.push(`    ${chalk.gray(line)}`);
            });
        }
    }
    
    // Performance metrics
    if (entry.performance.tokensPerSecond) {
        lines.push(`\n${chalk.bold('Performance:')} ${chalk.green(`${entry.performance.tokensPerSecond} tokens/sec`)}`);
    }
    
    return lines.join('\n');
}

// Main function
async function viewLLMLog(filePath: string) {
    try {
        // Resolve the file path
        const resolvedPath = resolve(filePath);
        
        // Check if file exists
        try {
            await fs.access(resolvedPath);
        } catch {
            console.error(chalk.red(`❌ File not found: ${filePath}`));
            process.exit(1);
        }
        
        // Read the file
        console.log(chalk.blue(`📖 Reading LLM log: ${resolvedPath}\n`));
        const content = await fs.readFile(resolvedPath, 'utf-8');
        
        // Parse JSONL
        const lines = content.trim().split('\n').filter(line => line.trim());
        const entries: LLMCallLogEntry[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            try {
                const entry = JSON.parse(lines[i]);
                entries.push(entry);
            } catch (error) {
                console.error(chalk.red(`❌ Failed to parse line ${i + 1}: ${error}`));
            }
        }
        
        if (entries.length === 0) {
            console.log(chalk.yellow('⚠️  No valid log entries found'));
            return;
        }
        
        // Summary
        console.log(chalk.bold(`📊 Summary:`));
        console.log(`  Total Entries: ${entries.length}`);
        console.log(`  Successful: ${chalk.green(entries.filter(e => e.status === 'success').length)}`);
        console.log(`  Failed: ${chalk.red(entries.filter(e => e.status === 'error').length)}`);
        
        const totalDuration = entries.reduce((sum, e) => sum + (e.durationMs || 0), 0);
        console.log(`  Total Duration: ${formatDuration(totalDuration)}`);
        
        const totalTokens = entries.reduce((sum, e) => sum + (e.response?.usage?.totalTokens || 0), 0);
        if (totalTokens > 0) {
            console.log(`  Total Tokens: ${chalk.yellow(totalTokens)}`);
        }
        
        const totalCost = entries.reduce((sum, e) => sum + (e.response?.usage?.cost || 0), 0);
        if (totalCost > 0) {
            console.log(`  Total Cost: ${chalk.green(`$${totalCost.toFixed(4)}`)}`);
        }
        
        console.log(chalk.gray('\n' + '═'.repeat(80) + '\n'));
        
        // Display each entry
        entries.forEach((entry, index) => {
            console.log(formatLogEntry(entry, index));
        });
        
    } catch (error) {
        console.error(chalk.red('❌ Error reading log file:'), error);
        process.exit(1);
    }
}

    // Get file path from command line
    const filePath = process.argv[2];

    if (!filePath) {
        console.error(chalk.red('❌ Usage: bun run llm-log <path-to-file>.jsonl'));
        process.exit(1);
    }

    // Run the viewer
    viewLLMLog(filePath).catch(console.error);
}