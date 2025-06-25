#!/usr/bin/env node
import { promises as fs } from "fs";
import { join } from "path";
import chalk from "chalk";
import { format } from "date-fns";

interface ToolCallLogEntry {
    timestamp: string;
    timestampMs: number;
    requestId: string;
    
    // Context
    agentName: string;
    phase: string;
    conversationId: string;
    
    // Tool information
    toolName: string;
    args: Record<string, unknown>;
    argsLength: number;
    
    // Result
    status: "success" | "error";
    output?: string;
    outputLength?: number;
    error?: string;
    metadata?: Record<string, unknown>;
    
    // Performance
    performance: {
        startTime: number;
        endTime: number;
        durationMs: number;
    };
    
    // Trace information
    trace: {
        callStack?: string[];
        parentRequestId?: string;
        batchId?: string;
        batchIndex?: number;
        batchSize?: number;
    };
}

async function readToolLogs(projectPath: string): Promise<ToolCallLogEntry[]> {
    const logDir = join(projectPath, ".tenex", "logs", "tools");
    const entries: ToolCallLogEntry[] = [];
    
    try {
        const files = await fs.readdir(logDir);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl')).sort();
        
        for (const file of jsonlFiles) {
            const content = await fs.readFile(join(logDir, file), 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);
            
            for (const line of lines) {
                try {
                    entries.push(JSON.parse(line));
                } catch (e) {
                    console.error(`Failed to parse line in ${file}:`, e);
                }
            }
        }
    } catch (error) {
        if ((error as any).code !== 'ENOENT') {
            throw error;
        }
    }
    
    return entries.sort((a, b) => a.timestampMs - b.timestampMs);
}

function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}

function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

async function main() {
    const projectPath = process.cwd();
    
    console.log(chalk.blue.bold('\n📊 Tool Execution Log\n'));
    
    const entries = await readToolLogs(projectPath);
    
    if (entries.length === 0) {
        console.log(chalk.yellow('No tool executions found.'));
        return;
    }
    
    // Group by batch
    const batches = new Map<string, ToolCallLogEntry[]>();
    const unbatched: ToolCallLogEntry[] = [];
    
    for (const entry of entries) {
        if (entry.trace.batchId) {
            const batch = batches.get(entry.trace.batchId) || [];
            batch.push(entry);
            batches.set(entry.trace.batchId, batch);
        } else {
            unbatched.push(entry);
        }
    }
    
    // Display batched executions
    for (const [batchId, batchEntries] of batches) {
        const firstEntry = batchEntries[0];
        console.log(chalk.cyan(`\n🔄 Batch: ${firstEntry.agentName} - ${format(new Date(firstEntry.timestamp), 'HH:mm:ss')}`));
        console.log(chalk.gray(`   Batch ID: ${batchId}`));
        console.log(chalk.gray(`   Phase: ${firstEntry.phase}`));
        
        for (const entry of batchEntries.sort((a, b) => (a.trace.batchIndex || 0) - (b.trace.batchIndex || 0))) {
            displayToolEntry(entry, true);
        }
        
        // Batch summary
        const totalDuration = batchEntries.reduce((sum, e) => sum + e.performance.durationMs, 0);
        const successful = batchEntries.filter(e => e.status === 'success').length;
        const failed = batchEntries.filter(e => e.status === 'error').length;
        
        console.log(chalk.gray(`   📈 Batch Summary: ${successful} successful, ${failed} failed, total duration: ${formatDuration(totalDuration)}`));
    }
    
    // Display unbatched executions
    if (unbatched.length > 0) {
        console.log(chalk.cyan('\n🔧 Individual Tool Executions:'));
        for (const entry of unbatched) {
            displayToolEntry(entry, false);
        }
    }
    
    // Overall summary
    console.log(chalk.blue.bold('\n📊 Overall Summary:'));
    console.log(chalk.white(`Total executions: ${entries.length}`));
    console.log(chalk.green(`Successful: ${entries.filter(e => e.status === 'success').length}`));
    console.log(chalk.red(`Failed: ${entries.filter(e => e.status === 'error').length}`));
    
    // Top tools by usage
    const toolCounts = new Map<string, number>();
    for (const entry of entries) {
        toolCounts.set(entry.toolName, (toolCounts.get(entry.toolName) || 0) + 1);
    }
    
    console.log(chalk.blue.bold('\n🏆 Top Tools by Usage:'));
    const sortedTools = Array.from(toolCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [tool, count] of sortedTools) {
        console.log(chalk.white(`  ${tool}: ${count} calls`));
    }
}

function displayToolEntry(entry: ToolCallLogEntry, indented: boolean = false) {
    const prefix = indented ? '   ' : '';
    const icon = entry.status === 'success' ? '✅' : '❌';
    const time = format(new Date(entry.timestamp), 'HH:mm:ss');
    
    console.log(`${prefix}${icon} ${chalk.yellow(entry.toolName)} [${time}] (${formatDuration(entry.performance.durationMs)})`);
    
    if (Object.keys(entry.args).length > 0) {
        const argsStr = JSON.stringify(entry.args);
        console.log(`${prefix}   Args: ${chalk.gray(truncate(argsStr, 100))}`);
    }
    
    if (entry.status === 'error' && entry.error) {
        console.log(`${prefix}   ${chalk.red('Error:')} ${entry.error}`);
    } else if (entry.output) {
        console.log(`${prefix}   Output: ${chalk.gray(truncate(entry.output, 100))} (${entry.outputLength} chars)`);
    }
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        console.log(`${prefix}   Metadata: ${chalk.gray(JSON.stringify(entry.metadata))}`);
    }
}

main().catch(console.error);