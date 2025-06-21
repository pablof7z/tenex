/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Wait for a specific amount of time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a function and expect it to throw
 */
export async function expectToThrow(
  fn: () => unknown | Promise<unknown>,
  errorMessage?: string | RegExp
): Promise<void> {
  let thrown = false;

  try {
    await fn();
  } catch (error) {
    thrown = true;
    if (errorMessage) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof errorMessage === "string") {
        if (!message.includes(errorMessage)) {
          throw new Error(`Expected error to contain "${errorMessage}" but got "${message}"`);
        }
      } else if (!errorMessage.test(message)) {
        throw new Error(`Expected error to match ${errorMessage} but got "${message}"`);
      }
    }
  }

  if (!thrown) {
    throw new Error("Expected function to throw but it did not");
  }
}

/**
 * Retry a function multiple times
 */
export async function retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await delay(delayMs);
      }
    }
  }

  throw lastError || new Error("Retry failed");
}
