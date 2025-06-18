export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause) {
    error.cause = cause;
  }
  return error;
}
