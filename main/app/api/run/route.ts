import { NextRequest, NextResponse } from "next/server";
import path from "path";

// We need fs for the access check, but not os
const fs = require("fs").promises;

// import os from 'os';
import { spawn } from "child_process";

// Basic validation for the command name (letters only, max 20 chars)
const isValidCmd = (cmd: string | null): cmd is string => {
    // Allow letters and hyphens, max 40 chars
    return cmd !== null && /^[a-zA-Z-]{1,40}$/.test(cmd);
};

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    console.log("searchParams", searchParams);
    const cmd = searchParams.get("cmd");
    const scriptsPath = process.env.SCRIPTS_PATH || path.resolve("./scripts"); // Default to ./scripts relative to project root

    // 1. Validate cmd parameter
    if (!isValidCmd(cmd)) {
        return NextResponse.json(
            { error: 'Invalid or missing "cmd" parameter. Must be 1-20 letters.' },
            { status: 400 },
        );
    }

    // 2. Construct script path and check existence/permissions
    const scriptPath = path.join(scriptsPath, cmd);
    try {
        // fs is now required at the top level
        await fs.access(scriptPath, fs.constants.X_OK); // Check if exists and is executable
    } catch (err) {
        console.error(`Script access error for ${scriptPath}:`, err);
        return NextResponse.json(
            { error: `Script "${cmd}" not found or not executable at ${scriptsPath}.` },
            { status: 404 },
        );
    }

    // No longer using temporary files
    // let tempFilePath: string | null = null;
    try {
        // 3. Read JSON payload
        const payload = await request.json();

        // 4. Prepare payload string
        const payloadString = JSON.stringify(payload, null, 2);

        // 5. Execute the script and wait for completion
        let exitCode: number | null = null;
        let stdoutData = "";
        let stderrData = "";

        try {
            // Inner try block for script execution and waiting
            // 5. Execute the script, piping stdin
            const scriptProcess = spawn(scriptPath, [], {
                // No file path argument
                stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr all piped
            });

            // 6. Write payload to script's stdin and close it
            scriptProcess.stdin.write(payloadString);
            scriptProcess.stdin.end(); // Signal end of input

            // Set up stdout/stderr listeners

            scriptProcess.stdout.on("data", (data: Buffer) => {
                stdoutData += data.toString();
            });

            scriptProcess.stderr.on("data", (data: Buffer) => {
                stderrData += data.toString();
            });

            // 7. Wait for script completion and handle result
            exitCode = await new Promise<number | null>((resolve, reject) => {
                scriptProcess.on("close", resolve);
                scriptProcess.on("error", (err) => {
                    console.error(`Script process error for "${cmd}":`, err);
                    reject(err); // Reject the promise to be caught by outer catch
                });
            });
        } finally {
            // No cleanup needed here as we are using stdin, not temp files.
        }

        // 8. Process script result
        if (exitCode === 0) {
            // Try to parse stdout as JSON, otherwise return as text
            try {
                const jsonOutput = JSON.parse(stdoutData);
                return NextResponse.json(jsonOutput);
            } catch (parseError) {
                return new NextResponse(stdoutData, { status: 200, headers: { "Content-Type": "text/plain" } });
            }
        } else {
            console.error(`Script "${cmd}" failed with exit code ${exitCode}. Stderr: ${stderrData}`);
            return NextResponse.json(
                {
                    error: `Script "${cmd}" failed.`,
                    details: stderrData || "No stderr output.",
                    exitCode: exitCode,
                },
                { status: 500 },
            );
        }
    } catch (error: any) {
        console.error(`Error processing request for cmd "${cmd}":`, error);

        // No temporary file cleanup needed in error handling either

        // Handle potential JSON parsing errors from request body
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return NextResponse.json({ error: "Invalid JSON payload provided." }, { status: 400 });
        }

        return NextResponse.json(
            { error: "An internal server error occurred.", details: error.message },
            { status: 500 },
        );
    }
}
