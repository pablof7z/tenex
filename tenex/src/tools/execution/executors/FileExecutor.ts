import { promises as fs } from "node:fs";
import path from "node:path";
import { logger } from "@/utils/logger";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutor,
  ToolInvocation,
  FileReadParameters,
  FileWriteParameters,
  FileEditParameters,
} from "@/types/tool";

export class FileExecutor implements ToolExecutor {
  name = "file";

  private readonly maxFileSize = 1024 * 1024 * 5; // 5MB

  private isFileReadParameters(params: any): params is FileReadParameters {
    return typeof params === 'object' && params !== null && 'path' in params && typeof params.path === 'string';
  }

  private isFileWriteParameters(params: any): params is FileWriteParameters {
    return typeof params === 'object' && params !== null && 
           'path' in params && typeof params.path === 'string' &&
           'content' in params && typeof params.content === 'string';
  }

  private isFileEditParameters(params: any): params is FileEditParameters {
    return typeof params === 'object' && params !== null && 
           'path' in params && typeof params.path === 'string' &&
           'oldContent' in params && typeof params.oldContent === 'string' &&
           'newContent' in params && typeof params.newContent === 'string';
  }

  canExecute(toolName: string): boolean {
    return toolName === "file";
  }

  async execute(
    invocation: ToolInvocation,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      switch (invocation.action) {
        case "read":
          return await this.readFile(invocation, context, startTime);
        case "write":
          return await this.writeFile(invocation, context, startTime);
        case "edit":
          return await this.editFile(invocation, context, startTime);
        default:
          throw new Error(`Unknown file action: ${invocation.action}`);
      }
    } catch (error) {
      logger.error("File operation failed", { error, invocation });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  private async readFile(
    invocation: ToolInvocation,
    context: ToolExecutionContext,
    startTime: number
  ): Promise<ToolExecutionResult> {
    if (!this.isFileReadParameters(invocation.parameters)) {
      throw new Error("Invalid parameters for file read");
    }
    const filePath = this.resolvePath(invocation.parameters.path, context.projectPath);

    // Check file exists
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error("Path is not a file");
    }

    // Check file size
    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
    }

    const content = await fs.readFile(filePath, "utf-8");

    logger.info("File read successfully", {
      path: filePath,
      size: stats.size,
      agent: context.agentName,
    });

    return {
      success: true,
      output: content,
      duration: Date.now() - startTime,
      metadata: {
        size: stats.size,
        path: filePath,
      },
    };
  }

  private async writeFile(
    invocation: ToolInvocation,
    context: ToolExecutionContext,
    startTime: number
  ): Promise<ToolExecutionResult> {
    if (!this.isFileWriteParameters(invocation.parameters)) {
      throw new Error("Invalid parameters for file write");
    }
    const filePath = this.resolvePath(invocation.parameters.path, context.projectPath);
    const content = invocation.parameters.content;

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write file
    await fs.writeFile(filePath, content, "utf-8");

    logger.info("File written successfully", {
      path: filePath,
      size: content.length,
      agent: context.agentName,
    });

    return {
      success: true,
      output: `File written: ${filePath} (${content.length} bytes)`,
      duration: Date.now() - startTime,
      metadata: {
        path: filePath,
        size: content.length,
      },
    };
  }

  private async editFile(
    invocation: ToolInvocation,
    context: ToolExecutionContext,
    startTime: number
  ): Promise<ToolExecutionResult> {
    if (!this.isFileEditParameters(invocation.parameters)) {
      throw new Error("Invalid parameters for file edit");
    }
    const filePath = this.resolvePath(invocation.parameters.path, context.projectPath);
    const oldContent = invocation.parameters.oldContent;
    const newContent = invocation.parameters.newContent;

    // Read current file
    const currentContent = await fs.readFile(filePath, "utf-8");

    // Find and replace
    if (!currentContent.includes(oldContent)) {
      throw new Error("Old content not found in file");
    }

    const updatedContent = currentContent.replace(oldContent, newContent);

    // Write back
    await fs.writeFile(filePath, updatedContent, "utf-8");

    logger.info("File edited successfully", {
      path: filePath,
      agent: context.agentName,
    });

    return {
      success: true,
      output: `File edited: ${filePath}`,
      duration: Date.now() - startTime,
      metadata: {
        path: filePath,
        changeSize: newContent.length - oldContent.length,
      },
    };
  }

  private resolvePath(filePath: string, projectPath: string): string {
    // Resolve relative paths
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);

    // Security check - ensure path is within project
    const normalizedPath = path.normalize(resolved);
    const normalizedProject = path.normalize(projectPath);

    if (!normalizedPath.startsWith(normalizedProject)) {
      throw new Error("File path is outside project directory");
    }

    return normalizedPath;
  }
}
