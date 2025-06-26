import { Project } from '../Project';
import { TestError } from '../types';

/**
 * Asserts that a file contains the expected text.
 * 
 * @param project - The project to check files in
 * @param filePath - Relative path to the file within the project
 * @param expected - The text that must be present in the file
 * @throws {TestError} If the file doesn't contain the expected text
 * 
 * @example
 * ```typescript
 * await assertFileContains(project, 'README.md', '# My Project');
 * await assertFileContains(project, 'package.json', '"name": "my-app"');
 * ```
 */
export async function assertFileContains(
  project: Project,
  filePath: string,
  expected: string
): Promise<void> {
  const content = await project.readFile(filePath);
  if (!content.includes(expected)) {
    throw new TestError(
      `File ${filePath} does not contain "${expected}"\nActual content:\n${content}`,
      {
        project: project.name,
        step: 'assertFileContains'
      }
    );
  }
}

/**
 * Asserts that a file's content matches the given pattern.
 * 
 * @param project - The project to check files in
 * @param filePath - Relative path to the file within the project
 * @param pattern - Regular expression pattern to match against file content
 * @throws {TestError} If the file content doesn't match the pattern
 * 
 * @example
 * ```typescript
 * await assertFileMatches(project, 'version.txt', /^\d+\.\d+\.\d+$/);
 * await assertFileMatches(project, 'config.js', /export\s+default\s+{/);
 * ```
 */
export async function assertFileMatches(
  project: Project,
  filePath: string,
  pattern: RegExp
): Promise<void> {
  const content = await project.readFile(filePath);
  if (!pattern.test(content)) {
    throw new TestError(
      `File ${filePath} does not match pattern ${pattern}\nActual content:\n${content}`,
      {
        project: project.name,
        step: 'assertFileMatches'
      }
    );
  }
}

/**
 * Asserts that a file exists in the project.
 * 
 * @param project - The project to check files in
 * @param filePath - Relative path to the file within the project
 * @throws {TestError} If the file does not exist
 * 
 * @example
 * ```typescript
 * await assertFileExists(project, 'src/index.js');
 * await assertFileExists(project, '.gitignore');
 * ```
 */
export async function assertFileExists(
  project: Project,
  filePath: string
): Promise<void> {
  const exists = await project.fileExists(filePath);
  if (!exists) {
    throw new TestError(
      `Expected file ${filePath} to exist but it does not`,
      {
        project: project.name,
        step: 'assertFileExists'
      }
    );
  }
}

/**
 * Asserts that a file does not exist in the project.
 * 
 * @param project - The project to check files in
 * @param filePath - Relative path to the file within the project
 * @throws {TestError} If the file exists
 * 
 * @example
 * ```typescript
 * await assertFileDoesNotExist(project, 'node_modules');
 * await assertFileDoesNotExist(project, 'temp.txt');
 * ```
 */
export async function assertFileDoesNotExist(
  project: Project,
  filePath: string
): Promise<void> {
  const exists = await project.fileExists(filePath);
  if (exists) {
    throw new TestError(
      `Expected file ${filePath} not to exist but it does`,
      {
        project: project.name,
        step: 'assertFileDoesNotExist'
      }
    );
  }
}

/**
 * Asserts that a file's size is within the specified range.
 * 
 * @param project - The project to check files in
 * @param filePath - Relative path to the file within the project
 * @param minSize - Minimum expected file size in bytes
 * @param maxSize - Maximum expected file size in bytes (optional)
 * @throws {TestError} If the file size is outside the specified range
 * 
 * @example
 * ```typescript
 * // Assert file is at least 100 bytes
 * await assertFileSize(project, 'data.json', 100);
 * 
 * // Assert file is between 1KB and 10KB
 * await assertFileSize(project, 'config.json', 1024, 10240);
 * ```
 */
export async function assertFileSize(
  project: Project,
  filePath: string,
  minSize: number,
  maxSize?: number
): Promise<void> {
  const content = await project.readFile(filePath);
  const size = content.length;
  
  if (size < minSize) {
    throw new TestError(
      `File ${filePath} is too small. Expected at least ${minSize} bytes but got ${size}`,
      {
        project: project.name,
        step: 'assertFileSize'
      }
    );
  }
  
  if (maxSize !== undefined && size > maxSize) {
    throw new TestError(
      `File ${filePath} is too large. Expected at most ${maxSize} bytes but got ${size}`,
      {
        project: project.name,
        step: 'assertFileSize'
      }
    );
  }
}

/**
 * Asserts that a file contains valid JSON and optionally validates its content.
 * 
 * @param project - The project to check files in
 * @param filePath - Relative path to the JSON file within the project
 * @param validator - Optional function to validate the parsed JSON
 * @returns The parsed JSON object
 * @throws {TestError} If the file is not valid JSON or validation fails
 * 
 * @example
 * ```typescript
 * // Just check if file is valid JSON
 * const data = await assertJsonFile(project, 'config.json');
 * 
 * // Validate JSON structure
 * await assertJsonFile(project, 'package.json', (json) => {
 *   if (!json.name) throw new Error('Missing name field');
 *   if (!json.version) throw new Error('Missing version field');
 * });
 * ```
 */
export async function assertJsonFile(
  project: Project,
  filePath: string,
  validator?: (json: any) => void
): Promise<any> {
  const content = await project.readFile(filePath);
  
  let json: any;
  try {
    json = JSON.parse(content);
  } catch (error) {
    throw new TestError(
      `File ${filePath} is not valid JSON: ${(error as Error).message}\nContent:\n${content}`,
      {
        project: project.name,
        step: 'assertJsonFile'
      }
    );
  }
  
  if (validator) {
    try {
      validator(json);
    } catch (error) {
      throw new TestError(
        `JSON validation failed for ${filePath}: ${(error as Error).message}`,
        {
          project: project.name,
          step: 'assertJsonFile'
        }
      );
    }
  }
  
  return json;
}