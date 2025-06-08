import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { nip19 } from "nostr-tools";
import NDK from "@nostr-dev-kit/ndk";

const PROJECTS_PATH = process.env.PROJECTS_PATH || path.join(process.cwd(), "projects");

export async function POST(req: NextRequest) {
    try {
        const { projectNaddr } = await req.json();

        if (!projectNaddr) {
            return NextResponse.json({ error: "Project naddr is required" }, { status: 400 });
        }

        // Decode the naddr to get the project event details
        let decodedNaddr;
        try {
            decodedNaddr = nip19.decode(projectNaddr);
            if (decodedNaddr.type !== "naddr") {
                throw new Error("Invalid naddr type");
            }
        } catch {
            return NextResponse.json({ error: "Invalid project naddr format" }, { status: 400 });
        }

        const { identifier, pubkey, kind, relays } = decodedNaddr.data;

        // Connect to Nostr to fetch the project event
        const ndk = new NDK({
            explicitRelayUrls: relays || ["wss://relay.damus.io", "wss://relay.nostr.band"],
        });

        await ndk.connect();

        // Fetch the project event
        const filter = {
            kinds: [kind],
            authors: [pubkey],
            "#d": [identifier],
        };

        const events = await ndk.fetchEvents(filter);
        if (events.size === 0) {
            return NextResponse.json({ error: "Project event not found on Nostr" }, { status: 404 });
        }

        const projectEvent = Array.from(events)[0];

        // Extract project details from the event
        const title = projectEvent.tags.find((tag) => tag[0] === "title")?.[1] || identifier;
        const keyTag = projectEvent.tags.find((tag) => tag[0] === "key")?.[1];

        if (!keyTag) {
            return NextResponse.json({ error: "Project is missing key information" }, { status: 400 });
        }

        // Parse the encrypted key data
        try {
            const keyData = JSON.parse(keyTag);
            // Validate that key data exists
            if (!keyData.nsec || !keyData.npub) {
                throw new Error("Missing nsec or npub in key data");
            }
        } catch {
            return NextResponse.json({ error: "Invalid project key format" }, { status: 400 });
        }

        // Check if project already exists
        const projectSlug = identifier;
        const projectPath = path.join(PROJECTS_PATH, projectSlug);

        if (fs.existsSync(projectPath)) {
            // Check if it's the same project by reading metadata
            try {
                const metadataPath = path.join(projectPath, ".tenex", "metadata.json");
                if (fs.existsSync(metadataPath)) {
                    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
                    if (metadata.projectNaddr === projectNaddr) {
                        return NextResponse.json({ error: "Project already imported" }, { status: 409 });
                    }
                }
            } catch {
                // If we can't read metadata, continue with conflict message
            }

            return NextResponse.json({ error: `Project directory already exists at ${projectSlug}` }, { status: 409 });
        }

        // Get the backend command from the request header
        const backendCommand = req.headers.get("x-backend-command") || "npx tenex";

        // Build the CLI command
        const command = `${backendCommand} project init "${projectPath}" --project-naddr "${projectNaddr}"`;

        console.log("Executing command:", command);

        try {
            // Execute the command
            const output = execSync(command, {
                cwd: process.cwd(),
                encoding: "utf8",
                env: {
                    ...process.env,
                    FORCE_COLOR: "0", // Disable color output for cleaner logs
                },
            });

            console.log("Command output:", output);

            // Verify the project was created
            if (!fs.existsSync(projectPath)) {
                throw new Error("Project directory was not created");
            }

            return NextResponse.json({
                success: true,
                projectPath: projectSlug,
                message: `Project "${title}" imported successfully`,
            });
        } catch (execError) {
            console.error("Command execution failed:", execError);

            // Clean up if the directory was partially created
            if (fs.existsSync(projectPath)) {
                try {
                    fs.rmSync(projectPath, { recursive: true, force: true });
                } catch (cleanupError) {
                    console.error("Failed to cleanup project directory:", cleanupError);
                }
            }

            const errorDetails = execError instanceof Error ? execError.message : "Unknown error";
            const errorOutput = (execError as any).stdout?.toString() || "";
            const errorStderr = (execError as any).stderr?.toString() || "";

            return NextResponse.json(
                {
                    error: "Failed to import project",
                    details: errorDetails,
                    output: errorOutput,
                    stderr: errorStderr,
                },
                { status: 500 },
            );
        }
    } catch (error) {
        console.error("Project import error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
