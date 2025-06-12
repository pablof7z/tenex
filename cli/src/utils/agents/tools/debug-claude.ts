#!/usr/bin/env bun

import { spawn } from 'child_process';
import chalk from 'chalk';

// Simple test to see what's happening with claude
async function debugClaude() {
  console.log(chalk.blue('Testing Claude CLI directly...\n'));
  
  const args = [
    '-p', 'Say hello world',
    '--verbose',
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions'
  ];
  
  console.log(chalk.gray('Command:'), `claude ${args.join(' ')}`);
  console.log(chalk.gray('Working dir:'), process.cwd());
  console.log(chalk.gray('Starting process...\n'));
  
  const proc = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let outputReceived = false;
  
  proc.stdout.on('data', (data: Buffer) => {
    outputReceived = true;
    console.log(chalk.green('STDOUT:'));
    console.log(data.toString());
  });
  
  proc.stderr.on('data', (data: Buffer) => {
    console.log(chalk.red('STDERR:'));
    console.log(data.toString());
  });
  
  proc.on('error', (error) => {
    console.error(chalk.red('Process error:'), error);
  });
  
  proc.on('close', (code) => {
    console.log(chalk.yellow(`\nProcess exited with code: ${code}`));
    if (!outputReceived) {
      console.log(chalk.red('No output was received from claude'));
    }
  });
  
  // Also try without shell
  setTimeout(() => {
    console.log(chalk.blue('\n\nTrying with shell: true...\n'));
    
    const proc2 = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
    
    proc2.stdout.on('data', (data: Buffer) => {
      console.log(chalk.green('STDOUT (shell):'));
      console.log(data.toString());
    });
    
    proc2.stderr.on('data', (data: Buffer) => {
      console.log(chalk.red('STDERR (shell):'));
      console.log(data.toString());
    });
    
    proc2.on('close', (code) => {
      console.log(chalk.yellow(`\nProcess (shell) exited with code: ${code}`));
    });
  }, 5000);
}

if (import.meta.main) {
  debugClaude().catch(console.error);
}