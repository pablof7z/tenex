/**
 * File System Abstraction Layer
 *
 * Provides a centralized, testable interface for all file system operations in the CLI.
 *
 * Usage:
 * ```typescript
 * import { fs } from './utils/fs';
 *
 * // Read a file
 * const content = await fs.readFile('~/config.json', 'utf8');
 *
 * // Write JSON
 * await fs.writeJSON('./data.json', { foo: 'bar' });
 *
 * // Check existence
 * if (await fs.exists('./file.txt')) {
 *   // ...
 * }
 * ```
 *
 * Testing:
 * ```typescript
 * import { MockFileSystem } from './utils/fs';
 *
 * const mockFs = new MockFileSystem({
 *   '/home/user/.tenex/config.json': '{"version": "1.0.0"}'
 * });
 *
 * // Use mockFs in tests
 * const config = await mockFs.readJSON('/home/user/.tenex/config.json');
 * ```
 */

export type { IFileSystem } from "./FileSystem";
export { FileSystem } from "./FileSystem";
export { MockFileSystem } from "./MockFileSystem";

import { FileSystem } from "./FileSystem";

// Global file system instance
// This can be replaced with a mock for testing
export let fs: FileSystem = new FileSystem();

/**
 * Replace the global file system instance (useful for testing)
 */
export function setFileSystem(fileSystem: FileSystem): void {
    fs = fileSystem;
}

/**
 * Reset to the default file system implementation
 */
export function resetFileSystem(): void {
    fs = new FileSystem();
}
