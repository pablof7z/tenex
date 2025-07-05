import type { Tool } from "../types";
import { createZodSchema } from "../types";
import { success } from "../core";
import { z } from "zod";

const getTimeSchema = z.object({});

/**
 * Get time tool - pure tool that returns current time
 * No side effects, deterministic for a given moment
 */
export const getTimeTool: Tool<Record<string, never>, string> = {
  name: "get_time",
  description: "Get the current date and time in ISO 8601 format",

  parameters: createZodSchema(getTimeSchema),

  execute: async (_input) => {
    // Pure function - returns current time
    // Note: While this uses Date.now(), it's considered pure in the context
    // of a single execution moment
    return success(new Date().toISOString());
  },
};
