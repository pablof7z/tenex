/**
 * Utility type exports
 */

export * from "./errors.js";

/**
 * Common utility types
 */

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? DeepPartial<U>[]
        : T[P] extends object
          ? DeepPartial<T[P]>
          : T[P];
};

/**
 * Make all properties of T required recursively
 */
export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends (infer U)[]
        ? DeepRequired<U>[]
        : T[P] extends object
          ? DeepRequired<T[P]>
          : T[P];
};

/**
 * Extract the promise type
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Make specified keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specified keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Union to intersection
 */
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
    k: infer I
) => void
    ? I
    : never;
