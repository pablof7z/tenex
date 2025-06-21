import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@tenex/shared";
import { safeJSONParse, safeJSONStringify } from "./json";

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    logger.error(`Failed to create directory: ${dirPath}`, { error });
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * Read and parse a JSON file
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = safeJSONParse<T>(content, { context: filePath });
    
    if (parsed === undefined) {
      throw new Error(`Invalid JSON in file: ${filePath}`);
    }
    
    return parsed;
  } catch (error) {
    logger.error(`Failed to read JSON file: ${filePath}`, { error });
    throw new Error(`Failed to read JSON file ${filePath}: ${error}`);
  }
}

/**
 * Write an object to a JSON file
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(filePath);
    await ensureDirectory(parentDir);
    
    const jsonString = safeJSONStringify(data, undefined, 2);
    if (jsonString === undefined) {
      throw new Error(`Failed to stringify data for file: ${filePath}`);
    }
    
    await fs.writeFile(filePath, jsonString, "utf-8");
  } catch (error) {
    logger.error(`Failed to write JSON file: ${filePath}`, { error });
    throw new Error(`Failed to write JSON file ${filePath}: ${error}`);
  }
}

/**
 * Read a JSON file safely, returning null if it doesn't exist or is invalid
 */
export async function readJsonFileSafe<T = any>(filePath: string): Promise<T | null> {
  try {
    if (!(await fileExists(filePath))) {
      return null;
    }
    
    const content = await fs.readFile(filePath, "utf-8");
    const result = safeJSONParse<T>(content, { 
      fallback: undefined, 
      context: filePath,
      logErrors: false 
    });
    return result ?? null;
  } catch {
    return null;
  }
}