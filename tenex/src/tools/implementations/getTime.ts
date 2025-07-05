import type { PureTool } from "../types";
import { createZodSchema } from "../types";
import { z } from "zod";

const getTimeSchema = z.object({});

/**
 * Get time tool - pure tool that returns current time
 * No side effects, deterministic for a given moment
 */
export const getTimeTool: PureTool<{}, string> = {
  brand: { _brand: "pure" },
  name: "get_time",
  description: "Get the current date and time in ISO 8601 format",

  parameters: createZodSchema(getTimeSchema),

  execute: (_input) => {
    // Pure function - returns current time
    // Note: While this uses Date.now(), it's considered pure in the context
    // of a single execution moment
    return new Date().toISOString();
  },
};
