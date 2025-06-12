/**
 * TENEX CLI: File Utility
 * Provides read/write helpers with ~ expansion and error handling.
 */
import * as fs from "fs";
import * as os from "os";
import * as pathModule from "path";

/**
 * Expands ~ to the user's home directory.
 */
function expandHome(filePath: string): string {
	if (filePath.startsWith("~")) {
		return pathModule.join(os.homedir(), filePath.slice(1));
	}
	return filePath;
}

export function readFile(path: string): string {
	const fullPath = expandHome(path);
	try {
		return fs.readFileSync(fullPath, "utf8");
	} catch (err) {
		throw new Error(`Failed to read file: ${fullPath}\n${err}`);
	}
}

export function writeFile(path: string, data: string) {
	const fullPath = expandHome(path);
	try {
		// Ensure directory exists
		fs.mkdirSync(pathModule.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, data, "utf8");
	} catch (err) {
		throw new Error(`Failed to write file: ${fullPath}\n${err}`);
	}
}
