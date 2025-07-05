import { isAbsolute, relative, resolve } from "node:path";
import type { z } from "zod";

/**
 * Resolves and validates a file path to ensure it stays within the project boundaries.
 *
 * @param filePath - The file path to validate (can be absolute or relative)
 * @param projectPath - The root project path
 * @returns The resolved absolute path if valid
 * @throws Error if the path would escape the project directory
 */
export function resolveAndValidatePath(filePath: string, projectPath: string): string {
  const fullPath = isAbsolute(filePath) ? filePath : resolve(projectPath, filePath);
  const relativePath = relative(projectPath, fullPath);

  if (relativePath.startsWith("..")) {
    throw new Error(`Path outside project directory: ${filePath}`);
  }

  return fullPath;
}

/**
 * Parse and validate tool parameters using a Zod schema.
 * Returns either the parsed data or a simple error object.
 */
export function parseToolParams<T extends z.ZodTypeAny>(
  schema: T,
  params: unknown
):
  | { success: true; data: z.infer<T> }
  | { success: false; errorResult: { success: false; error: string } } {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      success: false,
      errorResult: {
        success: false,
        error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      },
    };
  }
  return { success: true, data: parsed.data };
}
