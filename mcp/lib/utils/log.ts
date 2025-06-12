import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const id = Math.floor(Math.random() * 1000000);
const timeZero = Date.now();

/**
 * Simple logging utility
 * @param message Message to log
 * @param logFilePath Optional custom log file path
 */
export function log(
	message: string,
	logFilePath: string = path.join(os.homedir(), ".tenex.log"),
): void {
	// Ensure the directory exists
	const logDir = path.dirname(logFilePath);
	fs.mkdirSync(logDir, { recursive: true });

	const now = new Date();
	const timestamp = new Date().toISOString();
	const relativeTime = now.getTime() - timeZero;
	const logMessage = `[${id}] [${relativeTime}ms] ${timestamp} - ${message}\n`;
	fs.appendFile(logFilePath, logMessage, (err) => {
		if (err) {
			console.error("Error writing to log file:", err);
		}
	});
}
