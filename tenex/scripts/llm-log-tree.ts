#!/usr/bin/env bun

import { promises as fs } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import readline from "readline";
import type { LLMCallLogEntry } from "../src/llm/callLogger";

// Enable raw mode for keyboard input
if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
}

// Tree node types
type TreeNodeType = 'entry' | 'section' | 'message' | 'toolCall' | 'field';

// Tree node for hierarchical navigation
interface TreeNode {
    type: TreeNodeType;
    label: string;
    expanded: boolean;
    children?: TreeNode[];
    content?: string;
    metadata?: any;
    parent?: TreeNode;
    depth: number;
    // For navigation back to original data
    entryIndex?: number;
    messageIndex?: number;
    toolCallIndex?: number;
}

// Navigation state
interface NavigationState {
    entries: LLMCallLogEntry[];
    tree: TreeNode[];
    currentPath: number[]; // Path to current node [entryIndex, childIndex, ...]
    searchMode: boolean;
    searchQuery: string;
    searchResults: SearchResult[];
    currentSearchResult: number;
    viewportStart: number; // First visible line
}

// Search result
interface SearchResult {
    entryIndex: number;
    messageIndex: number;
    preview: string;
    matchStart: number;
    matchEnd: number;
}

// Clear screen
function clearScreen() {
    process.stdout.write('\x1B[2J\x1B[H');
}

// Get terminal height
function getTerminalHeight(): number {
    return process.stdout.rows || 30;
}

// Format bytes
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

// Get one-line summary of content
function getContentSummary(content: string, maxLength: number = 60): string {
    const oneLine = content.replace(/\n/g, ' ').trim();
    if (oneLine.length <= maxLength) {
        return oneLine;
    }
    return oneLine.substring(0, maxLength - 3) + '...';
}

// Get multi-line preview
function getMultiLinePreview(content: string, maxLines: number = 10): string {
    const lines = content.trim().split('\n');
    if (lines.length <= maxLines) {
        return content.trim();
    }
    return lines.slice(0, maxLines).join('\n') + '\n' + chalk.gray('... (' + (lines.length - maxLines) + ' more lines)');
}

// Build tree structure from entries
function buildTree(entries: LLMCallLogEntry[]): TreeNode[] {
    return entries.map((entry, entryIndex) => {
        const statusIcon = entry.status === 'success' ? '✅' : '❌';
        const timestamp = new Date(entry.timestamp).toLocaleString();
        
        // Get last user message for preview
        const lastUserMsg = [...entry.request.messages].reverse().find(m => m.role === 'user');
        const requestPreview = lastUserMsg ? getContentSummary(lastUserMsg.content, 80) : 'No user message';
        
        // Get response preview (one line for collapsed view)
        const responsePreview = entry.response?.content ? 
            getContentSummary(entry.response.content, 60) : 
            entry.error ? `Error: ${entry.error.message}` : 'No response';
        
        const entryNode: TreeNode = {
            type: 'entry',
            label: `${statusIcon} ${timestamp} - ${entry.configKey}`,
            expanded: false,
            depth: 0,
            entryIndex,
            children: [],
            metadata: {
                duration: formatDuration(entry.durationMs || 0),
                agent: entry.agentName,
                requestPreview,
                responsePreview
            }
        };
        
        // Request section
        const requestNode: TreeNode = {
            type: 'section',
            label: '📤 REQUEST',
            expanded: false,
            depth: 1,
            parent: entryNode,
            children: [],
            entryIndex,
            metadata: {
                lastMessage: lastUserMsg ? getContentSummary(lastUserMsg.content, 60) : null
            }
        };
        
        // Add messages
        entry.request.messages.forEach((msg, msgIndex) => {
            const roleIcon = msg.role === 'system' ? '🔧' : 
                           msg.role === 'user' ? '👤' : 
                           msg.role === 'assistant' ? '🤖' : '📝';
            
            const messageNode: TreeNode = {
                type: 'message',
                label: `${roleIcon} ${msg.role.toUpperCase()} (${formatBytes(msg.contentLength)}): ${getContentSummary(msg.content)}`,
                expanded: false,
                depth: 2,
                parent: requestNode,
                content: msg.content,
                messageIndex: msgIndex,
                metadata: { role: msg.role },
                children: [] // Add children array to allow expansion
            };
            
            requestNode.children!.push(messageNode);
        });
        
        // Response section
        if (entry.response) {
            const responseNode: TreeNode = {
                type: 'section',
                label: '📥 RESPONSE',
                expanded: false,
                depth: 1,
                parent: entryNode,
                children: [],
                entryIndex,
                metadata: {
                    preview: entry.response.content ? getContentSummary(entry.response.content, 60) : null
                }
            };
            
            // Don't create a separate content node - show content directly when RESPONSE is expanded
            
            if (entry.response.toolCalls && entry.response.toolCalls.length > 0) {
                entry.response.toolCalls.forEach((tc, tcIndex) => {
                    const toolNode: TreeNode = {
                        type: 'toolCall',
                        label: `🔨 ${tc.name} (${tc.id})`,
                        expanded: false,
                        depth: 2,
                        parent: responseNode,
                        toolCallIndex: tcIndex,
                        metadata: tc
                    };
                    responseNode.children!.push(toolNode);
                });
            }
            
            if (entry.response.usage) {
                const usageNode: TreeNode = {
                    type: 'field',
                    label: `📊 Usage: ${entry.response.usage.totalTokens || 0} tokens ($${entry.response.usage.cost?.toFixed(4) || '0.00'})`,
                    expanded: false,
                    depth: 2,
                    parent: responseNode,
                    metadata: entry.response.usage
                };
                responseNode.children!.push(usageNode);
            }
            
            entryNode.children!.push(responseNode);
        }
        
        // Error section
        if (entry.error) {
            const errorNode: TreeNode = {
                type: 'section',
                label: `❌ ERROR: ${entry.error.message}`,
                expanded: false,
                depth: 1,
                parent: entryNode,
                content: entry.error.stack
            };
            entryNode.children!.push(errorNode);
        }
        
        entryNode.children!.unshift(requestNode);
        
        return entryNode;
    });
}

// Get node from path
function getNodeFromPath(tree: TreeNode[], path: number[]): TreeNode | null {
    let node: TreeNode | null = null;
    let nodes = tree;
    
    for (const index of path) {
        if (index >= 0 && index < nodes.length) {
            node = nodes[index];
            nodes = node.children || [];
        } else {
            return null;
        }
    }
    
    return node;
}

// Get all visible nodes (flattened tree based on expansion state)
function getVisibleNodes(tree: TreeNode[], path: number[] = []): Array<{node: TreeNode, path: number[]}> {
    const visible: Array<{node: TreeNode, path: number[]}> = [];
    
    tree.forEach((node, index) => {
        const nodePath = [...path, index];
        visible.push({ node, path: nodePath });
        
        if (node.expanded && node.children) {
            visible.push(...getVisibleNodes(node.children, nodePath));
        }
    });
    
    return visible;
}

// Find path to node
function findNodePath(tree: TreeNode[], targetNode: TreeNode, currentPath: number[] = []): number[] | null {
    for (let i = 0; i < tree.length; i++) {
        const node = tree[i];
        const path = [...currentPath, i];
        
        if (node === targetNode) {
            return path;
        }
        
        if (node.children) {
            const childPath = findNodePath(node.children, targetNode, path);
            if (childPath) {
                return childPath;
            }
        }
    }
    
    return null;
}

// Display tree view
function displayTree(state: NavigationState) {
    clearScreen();
    
    const terminalHeight = getTerminalHeight();
    const headerHeight = 4;
    const footerHeight = 3;
    const availableHeight = terminalHeight - headerHeight - footerHeight;
    
    // Header
    console.log(chalk.bold.blue('🌳 LLM Log Tree Viewer'));
    console.log(chalk.gray(`${state.entries.length} entries | Use arrows to navigate, Enter to expand/collapse, / to search`));
    console.log(chalk.gray('═'.repeat(80)));
    console.log('');
    
    // Get all visible nodes
    const visibleNodes = getVisibleNodes(state.tree);
    const currentNode = getNodeFromPath(state.tree, state.currentPath);
    
    // Find current node index in visible nodes
    let currentVisibleIndex = -1;
    for (let i = 0; i < visibleNodes.length; i++) {
        if (visibleNodes[i].node === currentNode) {
            currentVisibleIndex = i;
            break;
        }
    }
    
    // Calculate viewport - we need to count actual lines, not just nodes
    if (currentVisibleIndex >= 0) {
        // Calculate how many lines we need for visible nodes
        let totalLinesNeeded = 0;
        let nodeLineCount: number[] = [];
        
        for (let i = 0; i < visibleNodes.length; i++) {
            const { node } = visibleNodes[i];
            let lines = 1; // Base line for the node
            
            // Count preview lines for collapsed entries
            if (node.type === 'entry' && !node.expanded && node.metadata) {
                lines += 5; // metadata + request + response preview lines
            }
            
            // Count preview lines for sections
            if (node.type === 'section' && !node.expanded && node.metadata) {
                lines += 1; // preview line
            }
            
            // Count content lines if expanded
            if (node.expanded && node.content) {
                const contentLines = node.content.split('\n').length;
                lines += Math.min(contentLines, 20); // Cap at 20 lines for viewport calc
            }
            
            nodeLineCount.push(lines);
            if (i <= currentVisibleIndex) {
                totalLinesNeeded += lines;
            }
        }
        
        // Now adjust viewport to keep current node visible
        let currentNodeStart = 0;
        for (let i = 0; i < currentVisibleIndex; i++) {
            currentNodeStart += nodeLineCount[i];
        }
        
        // Check if we need to scroll
        let viewportLines = 0;
        let viewportEndIndex = state.viewportStart;
        
        // Calculate what's currently visible
        for (let i = state.viewportStart; i < visibleNodes.length && viewportLines < availableHeight; i++) {
            viewportLines += nodeLineCount[i];
            viewportEndIndex = i;
        }
        
        // Scroll up if current node is above viewport
        if (currentVisibleIndex < state.viewportStart) {
            state.viewportStart = currentVisibleIndex;
        }
        // Scroll down if current node is below viewport
        else if (currentVisibleIndex > viewportEndIndex) {
            // Find the right viewport start to show current node
            state.viewportStart = currentVisibleIndex;
            
            // Try to show some context before if possible
            let testLines = nodeLineCount[currentVisibleIndex];
            for (let i = currentVisibleIndex - 1; i >= 0 && testLines + nodeLineCount[i] <= availableHeight; i--) {
                testLines += nodeLineCount[i];
                state.viewportStart = i;
            }
        }
    }
    
    // Display visible nodes
    let linesShown = 0;
    for (let i = state.viewportStart; i < visibleNodes.length && linesShown < availableHeight; i++) {
        const { node, path } = visibleNodes[i];
        const isSelected = node === currentNode;
        const indent = '  '.repeat(node.depth);
        
        // Determine expand/collapse indicator
        let expandIndicator = '';
        if (node.children && node.children.length > 0) {
            expandIndicator = node.expanded ? '▼ ' : '▶ ';
        } else {
            expandIndicator = '  ';
        }
        
        // Format the line
        let line = indent + expandIndicator + node.label;
        
        if (isSelected) {
            console.log(chalk.inverse(line));
        } else {
            // Color based on type
            switch (node.type) {
                case 'entry':
                    console.log(chalk.bold(line));
                    break;
                case 'section':
                    console.log(chalk.yellow(line));
                    break;
                case 'message':
                    console.log(chalk.green(line));
                    break;
                case 'toolCall':
                    console.log(chalk.cyan(line));
                    break;
                case 'field':
                    console.log(chalk.gray(line));
                    break;
                default:
                    console.log(line);
            }
        }
        
        linesShown++;
        
        // Show preview for entry nodes when collapsed
        if (node.type === 'entry' && !node.expanded && node.metadata) {
            // One-line preview when collapsed
            const oneLiner = `${indent}    ${chalk.gray(`${node.metadata.duration} |`)} ${chalk.green(node.metadata.requestPreview.substring(0, 30) + '...')} → ${chalk.magenta(node.metadata.responsePreview.substring(0, 30) + '...')}`;
            console.log(oneLiner);
            linesShown++;
        }
        
        // Show 3-line preview for expanded entries
        if (node.type === 'entry' && node.expanded && node.metadata) {
            // Show metadata
            console.log(`${indent}    ${chalk.gray(`Duration: ${node.metadata.duration} | Agent: ${node.metadata.agent || 'N/A'}`)}`);
            linesShown++;
        }
        
        // Show preview for sections based on parent expansion
        if (node.type === 'section' && !node.expanded && node.metadata && node.parent?.expanded) {
            if (node.label.includes('REQUEST') && node.metadata.lastMessage) {
                // 3-line preview when parent is expanded
                const lines = node.metadata.lastMessage.split(' ');
                const preview = lines.slice(0, 20).join(' ');
                console.log(`${indent}    ${chalk.gray('Last:')} ${chalk.green(preview)}`);
                linesShown++;
            } else if (node.label.includes('RESPONSE') && node.metadata.preview) {
                // 3-line preview when parent is expanded
                const lines = node.metadata.preview.split(' ');
                let currentLine = '';
                let lineCount = 0;
                
                for (const word of lines) {
                    if (currentLine.length + word.length + 1 > 70 && lineCount < 3) {
                        console.log(`${indent}    ${lineCount === 0 ? chalk.gray('Preview: ') : '         '}${chalk.magenta(currentLine)}`);
                        currentLine = word;
                        lineCount++;
                        linesShown++;
                    } else {
                        currentLine += (currentLine ? ' ' : '') + word;
                    }
                    
                    if (lineCount >= 3) break;
                }
                
                if (currentLine && lineCount < 3) {
                    console.log(`${indent}    ${lineCount === 0 ? chalk.gray('Preview: ') : '         '}${chalk.magenta(currentLine)}`);
                    linesShown++;
                }
            }
        }
        
        // Show full response content when RESPONSE section is expanded
        if (node.type === 'section' && node.expanded && node.label.includes('RESPONSE')) {
            // Find the response content in the original entry
            const entryIdx = node.entryIndex || node.parent?.entryIndex || 0;
            const entry = state.entries[entryIdx];
            if (entry.response?.content) {
                console.log(''); // Empty line before content
                linesShown++;
                
                const contentLines = formatContentWithEnhancements(entry.response.content).split('\n');
                for (const line of contentLines) {
                    if (linesShown >= availableHeight) break;
                    console.log(`${indent}  ${chalk.gray('│')} ${line}`);
                    linesShown++;
                }
                
                // Show metadata after content if there's room
                if (linesShown < availableHeight - 2 && entry.response.usage) {
                    console.log('');
                    console.log(`${indent}  ${chalk.gray('─'.repeat(60))}`);
                    console.log(`${indent}  ${chalk.gray(`Tokens: ${entry.response.usage.totalTokens || 0} | Cost: $${entry.response.usage.cost?.toFixed(4) || '0.00'}`)}`);
                    linesShown += 3;
                }
            }
        }
        
        // If node is expanded and has content, show it
        if (node.expanded && node.content && linesShown < availableHeight) {
            const contentLines = formatContentWithEnhancements(
                node.content, 
                node.metadata?.role === 'system'
            ).split('\n');
            
            for (const contentLine of contentLines) {
                if (linesShown >= availableHeight) break;
                console.log(chalk.gray(indent + '  │ ') + contentLine);
                linesShown++;
            }
        }
    }
    
    // Fill remaining space
    while (linesShown < availableHeight) {
        console.log('');
        linesShown++;
    }
    
    // Footer
    console.log(chalk.gray('═'.repeat(80)));
    console.log(chalk.gray('↑/↓ Navigate | ←/→ Collapse/Expand | Enter Toggle | / Search | q Quit'));
}

// Display search results
function displaySearchResults(state: NavigationState) {
    clearScreen();
    
    console.log(chalk.bold.yellow('🔍 Search Results'));
    console.log(chalk.gray(`Query: "${state.searchQuery}" | ${state.searchResults.length} matches found`));
    console.log(chalk.gray('Type to search | ↑/↓ to navigate | Enter to jump | Esc to exit'));
    console.log(chalk.gray('═'.repeat(80)));
    console.log('');
    
    if (state.searchResults.length === 0) {
        console.log(chalk.gray('No matches found'));
    } else {
        const maxResults = 10;
        const startIndex = Math.max(0, Math.min(state.currentSearchResult - 3, state.searchResults.length - maxResults));
        const endIndex = Math.min(startIndex + maxResults, state.searchResults.length);
        
        state.searchResults.slice(startIndex, endIndex).forEach((result, relativeIndex) => {
            const index = startIndex + relativeIndex;
            const isSelected = index === state.currentSearchResult;
            const entry = state.entries[result.entryIndex];
            const timestamp = new Date(entry.timestamp).toLocaleString();
            const messageType = result.messageIndex === -1 ? 'Response' : 
                               entry.request.messages[result.messageIndex].role;
            
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
    }
    
    console.log(chalk.gray('═'.repeat(80)));
}

// Perform search
function performSearch(entries: LLMCallLogEntry[], query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    
    entries.forEach((entry, entryIndex) => {
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
        
        if (entry.response?.content) {
            const content = entry.response.content.toLowerCase();
            const index = content.indexOf(lowerQuery);
            if (index !== -1) {
                const start = Math.max(0, index - 40);
                const end = Math.min(content.length, index + lowerQuery.length + 40);
                const preview = entry.response.content.substring(start, end).replace(/\n/g, ' ');
                results.push({
                    entryIndex,
                    messageIndex: -1,
                    preview: (start > 0 ? '...' : '') + preview + (end < content.length ? '...' : ''),
                    matchStart: start > 0 ? index - start + 3 : index - start,
                    matchEnd: start > 0 ? index - start + 3 + lowerQuery.length : index - start + lowerQuery.length
                });
            }
        }
    });
    
    return results;
}

// Main interactive function
async function runInteractive(filePath: string) {
    try {
        // Load entries
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
        
        // Build tree structure
        const tree = buildTree(entries);
        
        // Initialize state
        const state: NavigationState = {
            entries,
            tree,
            currentPath: [0], // Start at first entry
            searchMode: false,
            searchQuery: '',
            searchResults: [],
            currentSearchResult: 0,
            viewportStart: 0
        };
        
        // Ensure we have at least one entry
        if (tree.length === 0) {
            console.error(chalk.red('❌ No entries to display'));
            process.exit(1);
        }
        
        // Initial display
        displayTree(state);
        
        let searchBuffer = '';
        let isTypingSearch = false;
        
        // Handle keyboard input
        process.stdin.on('keypress', (str, key) => {
            if (!key) return;
            
            // Handle search typing
            if (isTypingSearch) {
                if (key.name === 'escape') {
                    isTypingSearch = false;
                    searchBuffer = '';
                    state.searchMode = false;
                    displayTree(state);
                } else if (key.name === 'return' && state.searchResults.length > 0) {
                    // Jump to result
                    const result = state.searchResults[state.currentSearchResult];
                    // Find the entry node
                    state.currentPath = [result.entryIndex];
                    state.searchMode = false;
                    isTypingSearch = false;
                    searchBuffer = '';
                    state.viewportStart = 0;
                    displayTree(state);
                } else if (key.name === 'up' && state.currentSearchResult > 0) {
                    state.currentSearchResult--;
                    displaySearchResults(state);
                    process.stdout.write('\n' + chalk.gray('Search: ') + chalk.yellow(searchBuffer));
                } else if (key.name === 'down' && state.currentSearchResult < state.searchResults.length - 1) {
                    state.currentSearchResult++;
                    displaySearchResults(state);
                    process.stdout.write('\n' + chalk.gray('Search: ') + chalk.yellow(searchBuffer));
                } else if (key.name === 'backspace') {
                    searchBuffer = searchBuffer.slice(0, -1);
                    if (searchBuffer.trim()) {
                        state.searchQuery = searchBuffer.trim();
                        state.searchResults = performSearch(state.entries, state.searchQuery);
                        state.currentSearchResult = 0;
                        state.searchMode = true;
                        displaySearchResults(state);
                        process.stdout.write('\n' + chalk.gray('Search: ') + chalk.yellow(searchBuffer));
                    } else {
                        state.searchMode = false;
                        displayTree(state);
                        process.stdout.write('\n' + chalk.gray('Search: ') + searchBuffer);
                    }
                } else if (str && str.length === 1 && !key.ctrl) {
                    searchBuffer += str;
                    state.searchQuery = searchBuffer.trim();
                    state.searchResults = performSearch(state.entries, state.searchQuery);
                    state.currentSearchResult = 0;
                    state.searchMode = true;
                    displaySearchResults(state);
                    process.stdout.write('\n' + chalk.gray('Search: ') + chalk.yellow(searchBuffer));
                }
                return;
            }
            
            // Regular navigation
            if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                clearScreen();
                process.exit(0);
            }
            
            const currentNode = getNodeFromPath(state.tree, state.currentPath);
            if (!currentNode) return;
            
            if (key.name === 'up') {
                // Navigate to previous visible node
                const visible = getVisibleNodes(state.tree);
                let currentIndex = -1;
                for (let i = 0; i < visible.length; i++) {
                    if (visible[i].node === currentNode) {
                        currentIndex = i;
                        break;
                    }
                }
                if (currentIndex > 0) {
                    state.currentPath = visible[currentIndex - 1].path;
                    displayTree(state);
                }
            } else if (key.name === 'down') {
                // Navigate to next visible node
                const visible = getVisibleNodes(state.tree);
                let currentIndex = -1;
                for (let i = 0; i < visible.length; i++) {
                    if (visible[i].node === currentNode) {
                        currentIndex = i;
                        break;
                    }
                }
                if (currentIndex >= 0 && currentIndex < visible.length - 1) {
                    state.currentPath = visible[currentIndex + 1].path;
                    displayTree(state);
                }
            } else if (key.name === 'pageup') {
                // Move up by screen height
                const visible = getVisibleNodes(state.tree);
                let currentIndex = -1;
                for (let i = 0; i < visible.length; i++) {
                    if (visible[i].node === currentNode) {
                        currentIndex = i;
                        break;
                    }
                }
                const termHeight = getTerminalHeight();
                const pageSize = Math.max(5, Math.floor((termHeight - 7) / 4));
                const newIndex = Math.max(0, currentIndex - pageSize);
                if (newIndex !== currentIndex) {
                    state.currentPath = visible[newIndex].path;
                    displayTree(state);
                }
            } else if (key.name === 'pagedown') {
                // Move down by screen height
                const visible = getVisibleNodes(state.tree);
                let currentIndex = -1;
                for (let i = 0; i < visible.length; i++) {
                    if (visible[i].node === currentNode) {
                        currentIndex = i;
                        break;
                    }
                }
                const termHeight = getTerminalHeight();
                const pageSize = Math.max(5, Math.floor((termHeight - 7) / 4));
                const newIndex = Math.min(visible.length - 1, currentIndex + pageSize);
                if (newIndex !== currentIndex) {
                    state.currentPath = visible[newIndex].path;
                    displayTree(state);
                }
            } else if (key.name === 'home') {
                // Go to first node
                state.currentPath = [0];
                state.viewportStart = 0;
                displayTree(state);
            } else if (key.name === 'end') {
                // Go to last visible node
                const visible = getVisibleNodes(state.tree);
                if (visible.length > 0) {
                    state.currentPath = visible[visible.length - 1].path;
                    displayTree(state);
                }
            } else if (key.name === 'right' || key.name === 'return') {
                // Expand current node or toggle content display
                if (currentNode.content && (currentNode.type === 'message' || currentNode.type === 'field')) {
                    // For nodes with content, toggle expansion to show full content
                    currentNode.expanded = !currentNode.expanded;
                    displayTree(state);
                } else if (currentNode.children && currentNode.children.length > 0) {
                    // For nodes with children, expand to show children
                    currentNode.expanded = true;
                    displayTree(state);
                }
            } else if (key.name === 'left') {
                // Collapse current node or go to parent
                if (currentNode.expanded) {
                    currentNode.expanded = false;
                    displayTree(state);
                } else if (currentNode.parent) {
                    // Navigate to parent
                    const parentPath = findNodePath(state.tree, currentNode.parent);
                    if (parentPath) {
                        state.currentPath = parentPath;
                        displayTree(state);
                    }
                }
            } else if (str === '/') {
                // Start search
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

// Main
const filePath = process.argv[2];

if (!filePath) {
    console.error(chalk.red('❌ Usage: bun run llm-log-tree <path-to-file>.jsonl'));
    process.exit(1);
}

// Check if file exists
fs.access(resolve(filePath))
    .then(() => runInteractive(filePath))
    .catch(() => {
        console.error(chalk.red(`❌ File not found: ${filePath}`));
        process.exit(1);
    });