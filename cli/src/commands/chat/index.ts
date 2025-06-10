import { Command } from "commander";
import { nip19 } from "nostr-tools";
import NDK, { filterAndRelaySetFromBech32, NDKEvent, NDKFilter } from "@nostr-dev-kit/ndk";
import { getNDK } from "../../nostr/ndkClient";
import { logger } from "../../utils/logger";
import { readFile } from "../../utils/file";
import { getAgentSigner } from "../../utils/agentManager";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";

interface ChatOptions {
    agent?: string;
}

interface SessionCache {
    [key: string]: string;
}

export function createChatCommand() {
    const command = new Command("chat");

    command
        .arguments("<nevent>")
        .description("Start or continue a chat conversation in a thread")
        .option("-a, --agent <agent>", "Agent slug to use (default: default)")
        .action(async (neventString: string, options: ChatOptions) => {
            try {
                await handleChat(neventString, options);
            } catch (error) {
                logger.error("Failed to handle chat:", error);
                process.exit(1);
            }
        });

    return command;
}

async function handleChat(neventString: string, options: ChatOptions) {
    const agentSlug = options.agent || "default";
    console.log("DEBUG: Starting handleChat with agent:", agentSlug);

    // Decode the nevent
    let threadId: string;
    try {
        console.log("DEBUG: Decoding nevent:", neventString);
        const decoded = nip19.decode(neventString);
        if (decoded.type !== "nevent") {
            throw new Error("Invalid nevent");
        }
        threadId = decoded.data.id;
        console.log("DEBUG: Thread ID:", threadId);
    } catch (error) {
        logger.error("Invalid nevent:", error);
        process.exit(1);
    }

    // Connect to Nostr
    logger.info("Connecting to Nostr...");
    const ndk = await getNDK();
    console.log("DEBUG: NDK connected");

    const { filter } = filterAndRelaySetFromBech32(neventString, ndk);
    if (!filter?.ids) throw new Error("Invalid nevent filter");
    const filters = [ filter, { "#E": filter.ids } ]
    
    // Parse project path from the thread or find it
    const projectPath = await findProjectPath();
    console.log("DEBUG: Project path:", projectPath);
    if (!projectPath) {
        logger.error("Could not determine project path");
        process.exit(1);
    }

    // Get agent signer (will create if doesn't exist)
    console.log("DEBUG: Getting agent signer for:", agentSlug);
    const { signer, agent, isNew } = await getAgentSigner(projectPath, agentSlug);
    console.log("DEBUG: Agent loaded:", agent.name, "isNew:", isNew);

    const thread = await ndk.fetchEvents(filters);
    console.log("DEBUG: Fetched thread events, converting to array...");
    const sortedReplies = Array.from(thread).sort((a, b) => 
        (a.created_at || 0) - (b.created_at || 0)
    );
    console.log('loaded replies', sortedReplies.length);

    const threadEvent = sortedReplies.find(event => event.kind === 11);
    if (!threadEvent) {
        logger.error("No thread event found in the conversation");
        process.exit(1);
    }

    // Build conversation context
    console.log("DEBUG: Building conversation context...");

    let conversationContext = "";

    for (const event of sortedReplies) {
        conversationContext += `### nostr:${event.author.npub}\n${event.content}\n\n`;
    }

    // Check for existing session
    const sessionKey = `${threadId}-${agentSlug}`;
    const sessionsPath = path.join(projectPath, ".tenex", "sessions", `${agentSlug}.json`);
    
    let sessions: SessionCache = {};
    let sessionId: string | undefined;
    let isNewSession = true;

    try {
        await fs.mkdir(path.dirname(sessionsPath), { recursive: true });
        const sessionData = await readFile(sessionsPath);
        sessions = JSON.parse(sessionData);
        sessionId = sessions[sessionKey];
        if (sessionId) {
            isNewSession = false;
            logger.info(`Resuming existing session: ${sessionId}`);
        }
    } catch (error) {
        // Sessions file doesn't exist yet
    }

    // Prepare the prompt
    let prompt = "Continue the conversation. Do not use any special formatting or escape characters";
    prompt += "This is the most current status of the conversation:\n\n";
    prompt += conversationContext;

    // DEBUG: Show the exact prompt being sent to goose
    console.log("\n=== DEBUG: PROMPT BEING SENT TO GOOSE ===");
    console.log(prompt);
    console.log("=== END OF PROMPT ===\n");

    // Run goose
    logger.info(`Starting goose session...`);
    const gooseArgs = [
        "run",
        "-i", "CLAUDE.md",
        "--name", sessionKey,
        "-t", prompt
    ];

    if (!isNewSession && sessionId) {
        gooseArgs.push("-r");
    }

    const goose = spawn("goose", gooseArgs, {
        cwd: projectPath,
        stdio: ["pipe", "pipe", "pipe"]
    });

    let response = "";
    let errorOutput = "";

    goose.stdout.on("data", (data) => {
        const text = data.toString();
        response += text;
        process.stdout.write(text);
    });

    goose.stderr.on("data", (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
    });

    goose.on("close", async (code) => {
        if (code !== 0) {
            logger.error(`Goose exited with code ${code}`);
            if (errorOutput) {
                logger.error("Error output:", errorOutput);
            }
            process.exit(1);
        }

        // Save session if new
        if (isNewSession) {
            sessions[sessionKey] = sessionKey; // Goose uses the name as session ID
            await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2));
            logger.info("Session saved for future use");
        }

        // Publish the response as a thread reply
        if (response.trim()) {
            logger.info("Publishing reply to thread...");
            
            // Clean up the response
            let cleanedResponse = response;
            
            // Remove session startup messages
            cleanedResponse = cleanedResponse.replace(/starting session.*?\n/gi, '');
            cleanedResponse = cleanedResponse.replace(/logging to.*?\n/gi, '');
            cleanedResponse = cleanedResponse.replace(/working directory:.*?\n/gi, '');
            
            // Remove ANSI escape codes
            cleanedResponse = cleanedResponse.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
            
            // Remove other escape sequences
            cleanedResponse = cleanedResponse.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
            
            // Trim extra whitespace
            cleanedResponse = cleanedResponse.trim();
            
            // Create reply event
            const replyEvent = threadEvent.reply();
            replyEvent.content = cleanedResponse;
            const aTag = threadEvent.tags.find(tag => tag[0] === "a");
            if (aTag) replyEvent.tags.push(aTag);

            // Sign with agent's key
            try {
                replyEvent.ndk = ndk;
                await replyEvent.sign(signer);
                await replyEvent.publish();
                
                logger.info(`Reply published successfully: ${replyEvent.encode()}`);
            } catch (error) {
                logger.error("Failed to publish reply:", error);
                process.exit(1);
            }
        }

        // Exit
        process.exit(0);
    });

    // Handle goose errors
    goose.on("error", (error) => {
        logger.error("Failed to start goose:", error);
        process.exit(1);
    });
}

async function findProjectPath(): Promise<string | null> {
    // Try to find project by checking metadata files
    // This is a simplified version - in production you might want to
    // search through known project directories or use a registry
    
    // For now, assume we're in the project directory
    const currentDir = process.cwd();
    console.log("DEBUG: Current directory:", currentDir);
    const metadataPath = path.join(currentDir, ".tenex", "metadata.json");
    
    try {
        console.log("DEBUG: Trying to read metadata from:", metadataPath);
        const metadata = JSON.parse(await readFile(metadataPath));
        console.log("DEBUG: Metadata loaded:", metadata);
        // Check if this project matches the reference
        // (You might need to adjust this based on how project references work)
        return currentDir;
    } catch (error) {
        console.log("DEBUG: Failed to read metadata:", error);
        // Try parent directories or other logic
        return null;
    }
}