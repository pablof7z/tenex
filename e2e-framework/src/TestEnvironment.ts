import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import type { TenexConfig } from './types';
import { getConfig } from './config';

export class TestEnvironment {
  private tempDir: string;
  private testId: string;
  
  constructor(testId?: string) {
    this.testId = testId || generateTestId();
    this.tempDir = '';
  }
  
  async setup(): Promise<void> {
    try {
      const config = getConfig();
      // Create isolated temp directory
      this.tempDir = path.join(tmpdir(), `${config.environment.tempDirPrefix}${this.testId}`);
      await mkdir(this.tempDir, { recursive: true });
      
      // Set up test-specific directories
      await mkdir(path.join(this.tempDir, '.tenex'));
      await mkdir(path.join(this.tempDir, 'projects'));
    } catch (error: any) {
      throw new Error(`Failed to setup test environment: ${error.message}`);
    }
  }
  
  async teardown(): Promise<void> {
    try {
      // Clean up temp directory
      if (this.tempDir) {
        await rm(this.tempDir, { recursive: true, force: true });
      }
    } catch (error: any) {
      // Log but don't throw - cleanup errors shouldn't fail tests
      console.warn(`Failed to cleanup test environment: ${error.message}`);
    }
  }
  
  getConfigDir(): string {
    return path.join(this.tempDir, '.tenex');
  }
  
  getProjectDir(projectName: string): string {
    return path.join(this.tempDir, 'projects', projectName);
  }
  
  async writeConfig(config: TenexConfig): Promise<void> {
    try {
      const configPath = path.join(this.getConfigDir(), 'config.json');
      await writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error: any) {
      throw new Error(`Failed to write config: ${error.message}`);
    }
  }
}

function generateTestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}