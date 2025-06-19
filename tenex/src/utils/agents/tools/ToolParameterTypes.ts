// Type-safe tool parameter definitions
export type ToolParameterValue =
    | string
    | number
    | boolean
    | ToolParameterValue[]
    | { [key: string]: ToolParameterValue };

export type TypedToolParameters<T extends Record<string, ToolParameterValue>> = T;

// Common parameter types for tools
export type ReadSpecsParams = Record<string, never>;

export interface UpdateSpecParams {
    filename: string;
    content: string;
    changelog: string;
}

export interface RememberLessonParams {
    lesson: string;
    context?: string;
}
