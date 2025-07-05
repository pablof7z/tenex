/**
 * Effect interpreter for executing tool effects
 */

import type {
  Effect,
  Result,
  ExecutionContext,
  ControlContext,
  TerminalContext,
  ToolError,
  SystemError,
} from "./core";
import { pure, fail } from "./core";
import { readFile, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "@/utils/logger";

const execAsync = promisify(exec);

/**
 * Effect interpreter that executes effects in a given context
 */
export class EffectInterpreter<Context extends ExecutionContext = ExecutionContext> {
  constructor(
    private readonly context: Context,
    private readonly capabilities: Capabilities
  ) {}

  /**
   * Interpret an effect, executing any side effects and returning the result
   */
  async interpret<E, A>(effect: Effect<E, A>): Promise<Result<E, A>> {
    try {
      return await this.interpretEffect(effect);
    } catch (error) {
      // Catch any unexpected errors and wrap them
      const systemError: SystemError = {
        kind: "system",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
      return { ok: false, error: systemError as E };
    }
  }

  private async interpretEffect<E, A>(effect: Effect<E, A>): Promise<Result<E, A>> {
    switch (effect._tag) {
      case "Pure":
        return { ok: true, value: effect.value };

      case "Failure":
        return { ok: false, error: effect.error };

      case "Suspend":
        return effect.effect();

      case "FlatMap": {
        const result = await this.interpretEffect(effect.effect);
        if (!result.ok) {
          return result;
        }
        return this.interpretEffect(effect.f(result.value));
      }
    }
  }

  /**
   * Create common effects for tools to use
   */
  effects = {
    readFile: (path: string): Effect<ToolError, string> => {
      if (!this.capabilities.fileSystem.read) {
        return fail({
          kind: "execution",
          tool: "readFile",
          message: "File system read access not available",
        });
      }

      return {
        _tag: "Suspend",
        effect: async () => {
          try {
            const fullPath = this.resolvePath(path);
            const content = await readFile(fullPath, "utf-8");
            return { ok: true, value: content };
          } catch (error) {
            return {
              ok: false,
              error: {
                kind: "execution",
                tool: "readFile",
                message: `Failed to read file: ${path}`,
                cause: error,
              },
            };
          }
        },
      };
    },

    writeFile: (path: string, content: string): Effect<ToolError, void> => {
      if (!this.capabilities.fileSystem.write) {
        return fail({
          kind: "execution",
          tool: "writeFile",
          message: "File system write access not available",
        });
      }

      return {
        _tag: "Suspend",
        effect: async () => {
          try {
            const fullPath = this.resolvePath(path);
            await writeFile(fullPath, content, "utf-8");
            return { ok: true, value: undefined };
          } catch (error) {
            return {
              ok: false,
              error: {
                kind: "execution",
                tool: "writeFile",
                message: `Failed to write file: ${path}`,
                cause: error,
              },
            };
          }
        },
      };
    },

    shell: (command: string): Effect<ToolError, { stdout: string; stderr: string }> => {
      if (!this.capabilities.shell) {
        return fail({
          kind: "execution",
          tool: "shell",
          message: "Shell access not available",
        });
      }

      return {
        _tag: "Suspend",
        effect: async () => {
          try {
            const { stdout, stderr } = await execAsync(command, {
              cwd: this.context.projectPath,
            });
            return { ok: true, value: { stdout, stderr } };
          } catch (error: any) {
            return {
              ok: false,
              error: {
                kind: "execution",
                tool: "shell",
                message: `Command failed: ${command}`,
                cause: error,
              },
            };
          }
        },
      };
    },

    log: (level: string, message: string): Effect<never, void> => {
      switch (level) {
        case "info":
          return pure(logger.info(message));
        case "error":
          return pure(logger.error(message));
        case "warn":
          return pure(logger.warn(message));
        case "debug":
          return pure(logger.debug(message));
        default:
          return pure(logger.info(message));
      }
    },
  };

  private resolvePath(path: string): string {
    if (path.startsWith("/")) {
      return path;
    }
    return `${this.context.projectPath}/${path}`;
  }
}

/**
 * Capabilities that can be granted to an interpreter
 */
export interface Capabilities {
  fileSystem: {
    read: boolean;
    write: boolean;
  };
  shell: boolean;
  network: boolean;
}

/**
 * Create interpreter for different contexts
 */
export function createInterpreter(
  context: ExecutionContext,
  capabilities: Capabilities
): EffectInterpreter<ExecutionContext> {
  return new EffectInterpreter(context, capabilities);
}

export function createControlInterpreter(
  context: ControlContext,
  capabilities: Capabilities
): EffectInterpreter<ControlContext> {
  return new EffectInterpreter(context, capabilities);
}

export function createTerminalInterpreter(
  context: TerminalContext,
  capabilities: Capabilities
): EffectInterpreter<TerminalContext> {
  return new EffectInterpreter(context, capabilities);
}

/**
 * Default capabilities for different agent types
 */
export const defaultCapabilities: Capabilities = {
  fileSystem: { read: true, write: true },
  shell: true,
  network: false,
};

export const restrictedCapabilities: Capabilities = {
  fileSystem: { read: true, write: false },
  shell: false,
  network: false,
};
