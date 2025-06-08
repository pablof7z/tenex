#!/usr/bin/env node

// Test script to verify the agent publishing system works

const { spawn } = require('child_process');
const path = require('path');

// Start the MCP server
const configFile = path.join(__dirname, '.tenex', 'agents.json');
const mcpPath = path.join(__dirname, 'mcp', 'tenex-mcp');

console.log('Starting MCP server with config:', configFile);
const mcp = spawn(mcpPath, ['--config-file', configFile]);

// Handle MCP output
mcp.stdout.on('data', (data) => {
    console.log('MCP stdout:', data.toString());
});

mcp.stderr.on('data', (data) => {
    console.log('MCP stderr:', data.toString());
});

// Send a test command after a brief delay
setTimeout(() => {
    console.log('\nSending test publish_task_status_update command...');
    
    const testCommand = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
            name: "publish_task_status_update",
            arguments: {
                update: "Testing the new agent system - this is a code agent update",
                taskId: "test-task-123",
                confidence_level: 8,
                title: "Test agent system implementation",
                agent_name: "code"
            }
        },
        id: 1
    };
    
    mcp.stdin.write(JSON.stringify(testCommand) + '\n');
    
    // Send another test with a different agent
    setTimeout(() => {
        console.log('\nSending test with planner agent...');
        
        const testCommand2 = {
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: "publish_task_status_update",
                arguments: {
                    update: "Planning the next steps for the project",
                    taskId: "test-task-123",
                    confidence_level: 9,
                    title: "Planning phase complete",
                    agent_name: "planner"
                }
            },
            id: 2
        };
        
        mcp.stdin.write(JSON.stringify(testCommand2) + '\n');
        
        // Close after a delay
        setTimeout(() => {
            console.log('\nClosing MCP server...');
            mcp.stdin.end();
            setTimeout(() => process.exit(0), 1000);
        }, 3000);
    }, 3000);
}, 2000);

mcp.on('close', (code) => {
    console.log(`MCP server exited with code ${code}`);
});