/**
 * TENEX CLI: File Utility
 * Provides read/write helpers with ~ expansion and error handling.
 *
 * @deprecated Use the new file system abstraction from './fs' instead.
 * This module is maintained for backward compatibility.
 */
import { fs } from "./fs";

/**
 * Expands ~ to the user's home directory.
 * @deprecated Use fs.expandHome() instead
 */
function expandHome(filePath: string): string {
	return fs.expandHome(filePath);
}

/**
 * @deprecated Use fs.readFileSync() or fs.readFile() instead
 */
export function readFile(path: string): string {
	try {
		return fs.readFileSync(path, "utf8");
	} catch (err) {
		const fullPath = fs.expandHome(path);
		throw new Error(`Failed to read file: ${fullPath}\n${err}`);
	}
}

/**
 * @deprecated Use fs.writeFileSync() or fs.writeFile() instead
 */
export function writeFile(path: string, data: string) {
	try {
		fs.writeFileSync(path, data, "utf8");
	} catch (err) {
		const fullPath = fs.expandHome(path);
		throw new Error(`Failed to write file: ${fullPath}\n${err}`);
	}
}
