import { exec, execSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { logDebug, logError, logInfo } from "@tenex/shared/logger";
import chalk from "chalk";

const execAsync = promisify(exec);

// Alternative 1: Using stdio: 'inherit' to see output directly
export async function alternative1() {
    logInfo(chalk.blue("\nAlternative 1: stdio inherit"));

    const proc = spawn(
        "claude",
        [
            "-p",
            "--dangerously-skip-permissions",
            "--output-format",
            "stream-json",
            "--verbose",
            "say hello and exit",
        ],
        {
            stdio: "inherit", // This will show output directly in console
        }
    );

    return new Promise((resolve, reject) => {
        proc.on("close", (code) => {
            if (code === 0) resolve("Done");
            else reject(new Error(`Exit code: ${code}`));
        });
    });
}

// Alternative 2: Using exec (buffers all output)
export async function alternative2() {
    logInfo(chalk.blue("\nAlternative 2: exec (buffered)"));

    try {
        const { stdout, stderr } = await execAsync(
            `claude -p --dangerously-skip-permissions --output-format stream-json --verbose "say hello and exit"`
        );
        logDebug(`STDOUT: ${stdout}`);
        if (stderr) logDebug(`STDERR: ${stderr}`);
        return stdout;
    } catch (error) {
        logError(`Error: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

// Alternative 3: Using different stdio configuration
export async function alternative3() {
    logInfo(chalk.blue("\nAlternative 3: Mixed stdio"));

    const proc = spawn(
        "claude",
        [
            "-p",
            "--dangerously-skip-permissions",
            "--output-format",
            "stream-json",
            "--verbose",
            "say hello and exit",
        ],
        {
            stdio: ["ignore", "pipe", "inherit"], // ignore stdin, pipe stdout, inherit stderr
        }
    );

    let output = "";

    if (proc.stdout) {
        proc.stdout.setEncoding("utf8");
        proc.stdout.on("data", (chunk) => {
            logDebug(`Got chunk: ${chunk.substring(0, 100)}...`);
            output += chunk;
        });
    }

    return new Promise((resolve, reject) => {
        proc.on("close", (code) => {
            logDebug(`Process closed with code ${code}`);
            if (code === 0) resolve(output);
            else reject(new Error(`Exit code: ${code}`));
        });
    });
}

// Alternative 4: Using shell: true
export async function alternative4() {
    logInfo(chalk.blue("\nAlternative 4: shell: true"));

    const proc = spawn(
        "claude",
        [
            "-p",
            "--dangerously-skip-permissions",
            "--output-format",
            "stream-json",
            "--verbose",
            "say hello and exit",
        ],
        {
            shell: true,
            stdio: ["pipe", "pipe", "pipe"],
        }
    );

    let output = "";
    let errorOutput = "";

    proc.stdout?.on("data", (data) => {
        const str = data.toString();
        logDebug(`STDOUT chunk: ${str.substring(0, 50)}...`);
        output += str;
    });

    proc.stderr?.on("data", (data) => {
        const str = data.toString();
        logDebug(`STDERR chunk: ${str}`);
        errorOutput += str;
    });

    return new Promise((resolve, reject) => {
        proc.on("close", (code) => {
            logDebug(`Process closed with code ${code}`);
            if (code === 0) resolve(output);
            else reject(new Error(`Exit code: ${code}, stderr: ${errorOutput}`));
        });
    });
}

// Alternative 5: Try with Bun's $ template literal
export async function alternative5() {
    logInfo(chalk.blue("\nAlternative 5: Bun $ command"));

    try {
        // Bun's shell syntax
        const result =
            await Bun.$`claude -p --dangerously-skip-permissions --output-format stream-json --verbose "say hello and exit"`;
        const output = await result.text();
        logDebug(`Output: ${output}`);
        return output;
    } catch (error) {
        logError(`Error: ${error}`);
        throw error;
    }
}

// Test all alternatives
export async function testAllAlternatives() {
    logInfo(chalk.yellow("Testing different spawn approaches...\n"));

    // Test each one
    for (const [name, fn] of Object.entries({
        alternative1,
        alternative2,
        alternative3,
        alternative4,
        alternative5,
    })) {
        try {
            logInfo(chalk.gray(`\n--- Testing ${name} ---`));
            await fn();
            logInfo(chalk.green(`✓ ${name} completed`));
        } catch (error) {
            logError(chalk.red(`✗ ${name} failed: ${error}`));
        }

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
}

if (import.meta.main) {
    testAllAlternatives().catch((error) => logError(`Test failed: ${error}`));
}
