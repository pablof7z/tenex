/**
 * Helper functions for validating fragment arguments
 */

export function hasProperty<T extends object, K extends string | number | symbol>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function createValidator<T>(
  checks: Array<(value: unknown) => boolean>,
  debugInfo?: (value: unknown) => string
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    const allChecksPass = checks.every((check) => {
      try {
        return check(value);
      } catch {
        return false;
      }
    });

    if (!allChecksPass && debugInfo) {
      console.error("Validation failed:", debugInfo(value));
    }

    return allChecksPass;
  };
}

// Common validators
export const validators = {
  hasRequiredString: (key: string) => (obj: unknown) =>
    isObject(obj) && hasProperty(obj, key) && isString(obj[key]),

  hasOptionalString: (key: string) => (obj: unknown) =>
    isObject(obj) && (!hasProperty(obj, key) || isString(obj[key])),

  hasRequiredNumber: (key: string) => (obj: unknown) =>
    isObject(obj) && hasProperty(obj, key) && isNumber(obj[key]),

  hasOptionalBoolean: (key: string) => (obj: unknown) =>
    isObject(obj) && (!hasProperty(obj, key) || isBoolean(obj[key])),

  hasStringArray: (key: string) => (obj: unknown) =>
    isObject(obj) &&
    hasProperty(obj, key) &&
    isArray(obj[key]) &&
    (obj[key] as unknown[]).every(isString),

  hasOptionalStringArray: (key: string) => (obj: unknown) =>
    isObject(obj) &&
    (!hasProperty(obj, key) || (isArray(obj[key]) && (obj[key] as unknown[]).every(isString))),
};
