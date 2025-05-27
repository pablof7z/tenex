/**
 * TENEX CLI: Config Manager
 * Handles reading/writing config at ~/.tenex/config
 */
import { readFile, writeFile } from "../utils/file";
import { TenexConfig } from "../types";

const CONFIG_PATH = "~/.tenex/config";

export class ConfigManager {
  static loadConfig(): TenexConfig | null {
    try {
      const raw = readFile(CONFIG_PATH);
      return JSON.parse(raw) as TenexConfig;
    } catch (err: any) {
      // If file not found, return null (first run)
      if (err.message && err.message.includes("no such file or directory")) {
        return null;
      }
      throw err;
    }
  }

  static saveConfig(config: TenexConfig) {
    try {
      writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
      throw new Error("Failed to save TENEX config: " + err);
    }
  }
}