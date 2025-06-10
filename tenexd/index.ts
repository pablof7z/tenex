import NDK, { NDKEvent, NDKPrivateKeySigner, NDKFilter, NDKUser } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import qrcode from "qrcode";
import { ConfigManager } from "./src/config/config.js";
import { handleTaskEvent } from "./src/projects/handler.js";
import { handleChatEvent } from "./src/nostr/chatHandler.js";

const COMMAND_KIND = 9801;
const STATUS_KIND = 24009;
const TASK_KIND = 24010;
const CHAT_KIND = 11;
const CHAT_REPLY_KIND = 1111;

async function generateQRCode(text: string): Promise<void> {
    try {
        const qr = await qrcode.toString(text, { type: "terminal", small: true });
        console.log(qr);
    } catch (err) {
        console.error(chalk.red("Error generating QR code:"), err);
    }
}

async function promptForPubkey(): Promise<string | null> {
    console.log(chalk.yellow("\nEnter a pubkey to whitelist (npub or hex format):"));
    console.log(chalk.gray("Press Enter to skip and accept commands from anyone\n"));
    
    process.stdout.write(chalk.cyan("> "));
    
    for await (const line of console) {
        const input = line.trim();
        
        if (input === "") {
            return null;
        }
        
        try {
            let pubkey: string;
            
            if (input.startsWith("npub")) {
                const user = new NDKUser({ npub: input });
                pubkey = user.pubkey;
            } else if (/^[0-9a-fA-F]{64}$/.test(input)) {
                pubkey = input.toLowerCase();
            } else {
                throw new Error("Invalid format. Please enter npub or 64-character hex pubkey");
            }
            
            return pubkey;
        } catch (err) {
            console.error(chalk.red(`\n❌ ${err instanceof Error ? err.message : "Invalid input"}`));
            console.log(chalk.yellow("\nPlease try again:"));
            process.stdout.write(chalk.cyan("> "));
        }
    }
    
    return null;
}

async function publishStatusEvent(ndk: NDK, whitelistedPubkeys: string[], hostname: string): Promise<void> {
    try {
        const event = new NDKEvent(ndk);
        event.kind = STATUS_KIND;
        event.content = hostname;
        
        whitelistedPubkeys.forEach(pubkey => {
            event.tags.push(["p", pubkey]);
        });
        
        await event.publish();
        console.log(chalk.green(`✅ Published status event (kind ${STATUS_KIND}) from ${hostname} with ${whitelistedPubkeys.length} p-tags`));
    } catch (error) {
        console.error(chalk.red("❌ Failed to publish status event:"), error);
    }
}

async function main() {
    console.log(chalk.cyan.bold("\n🚀 Starting TENEX Daemon...\n"));

    const configManager = new ConfigManager();
    const config = await configManager.getConfig();

    // Check for required taskCommand
    if (!config.taskCommand) {
        console.error(chalk.red("❌ Configuration error: 'taskCommand' is required but not set in config.json"));
        console.error(chalk.yellow("Please add a 'taskCommand' field to your config.json file."));
        console.error(chalk.gray("Example: \"taskCommand\": \"tenex run --roo\""));
        process.exit(1);
    }

    const daemonUser = new NDKUser({ pubkey: config.publicKey });
    const npub = daemonUser.npub;
    
    console.log(chalk.green("✅ Configuration loaded"));
    console.log(chalk.yellow("📍 Public Key (npub):"), chalk.white(npub));
    console.log(chalk.yellow("📋 Task Command:"), chalk.white(config.taskCommand));
    console.log(chalk.yellow("\n📱 Scan this QR code to add the daemon:\n"));
    
    await generateQRCode(npub);
    
    const signer = new NDKPrivateKeySigner(config.privateKey);
    const ndk = new NDK({
        explicitRelayUrls: config.relays,
        signer
    });

    console.log(chalk.yellow("\n🔌 Connecting to relays..."));
    
    await ndk.connect();
    
    console.log(chalk.green("✅ Connected to relays:"));
    config.relays.forEach(relay => {
        console.log(chalk.gray(`   - ${relay}`));
    });

    if (config.whitelistedPubkeys.length === 0) {
        console.log(chalk.yellow("\n⚠️  No whitelisted pubkeys configured."));
        
        const pubkeyToAdd = await promptForPubkey();
        
        if (pubkeyToAdd) {
            await configManager.addWhitelistedPubkey(pubkeyToAdd);
            config.whitelistedPubkeys.push(pubkeyToAdd);
            const addedUser = new NDKUser({ pubkey: pubkeyToAdd });
            console.log(chalk.green(`\n✅ Added ${addedUser.npub} to whitelist`));
        } else {
            console.log(chalk.yellow("\n⚠️  Running without whitelist - accepting commands from anyone"));
        }
    }
    
    if (config.whitelistedPubkeys.length > 0) {
        console.log(chalk.green("\n🔒 Whitelisted pubkeys:"));
        config.whitelistedPubkeys.forEach(pk => {
            const user = new NDKUser({ pubkey: pk });
            console.log(chalk.gray(`   - ${user.npub}`));
        });
    }

    console.log(chalk.cyan("\n👂 Listening for commands (kind: " + COMMAND_KIND + ")...\n"));

    const commandFilter: NDKFilter = {
        kinds: [COMMAND_KIND],
        since: Math.floor(Date.now() / 1000)
    };

    const commandSubscription = ndk.subscribe(commandFilter, { closeOnEose: false });

    commandSubscription.on("event", (event: NDKEvent) => {
        const author = event.author.pubkey;
        const authorUser = new NDKUser({ pubkey: author });
        const authorNpub = authorUser.npub;
        
        if (config.whitelistedPubkeys.length > 0 && !config.whitelistedPubkeys.includes(author)) {
            console.log(chalk.red(`\n❌ Unauthorized command from ${authorNpub}`));
            return;
        }

        const command = event.tagValue("command");
        const project = event.tagValue("project");
        const timestamp = new Date(event.created_at! * 1000).toLocaleString();

        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.cyan("📨 New Command Received"));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.gray("Time:     ") + chalk.white(timestamp));
        console.log(chalk.gray("From:     ") + chalk.white(authorNpub));
        console.log(chalk.gray("Command:  ") + chalk.yellow(command || "<no command>"));
        console.log(chalk.gray("Project:  ") + chalk.magenta(project || "<no project>"));
        console.log(chalk.gray("Event ID: ") + chalk.gray(event.id));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
    });

    console.log(chalk.cyan("\n👂 Listening for task events (kind: " + TASK_KIND + ") from whitelisted pubkeys...\n"));

    const taskFilter: NDKFilter = {
        kinds: [TASK_KIND],
        authors: config.whitelistedPubkeys,
        since: Math.floor(Date.now() / 1000)
    };

    const taskSubscription = ndk.subscribe(taskFilter, { closeOnEose: false });

    taskSubscription.on("event", async (event: NDKEvent) => {
        const author = event.author.pubkey;
        const authorUser = new NDKUser({ pubkey: author });
        const authorNpub = authorUser.npub;
        
        const projectTag = event.tagValue("a");
        const taskId = event.tagValue("e");
        const timestamp = new Date(event.created_at! * 1000).toLocaleString();

        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.magenta("📋 New Task Event Received"));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.gray("Time:       ") + chalk.white(timestamp));
        console.log(chalk.gray("From:       ") + chalk.white(authorNpub));
        console.log(chalk.gray("Project ID: ") + chalk.cyan(projectTag || "<no project>"));
        console.log(chalk.gray("Task ID:    ") + chalk.yellow(taskId || "<no task>"));
        console.log(chalk.gray("Event ID:   ") + chalk.gray(event.id));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
        
        // Handle the task event with project directory checking
        await handleTaskEvent(event, config, ndk);
    });

    let chatReplySubscription: any = null;

    if (config.chatCommand) {
        console.log(chalk.cyan("\n💬 Listening for chat events (kind: " + CHAT_KIND + ") from whitelisted pubkeys...\n"));
        
        const chatFilter: NDKFilter = {
            kinds: [CHAT_KIND],
            authors: config.whitelistedPubkeys.length > 0 ? config.whitelistedPubkeys : undefined,
            since: Math.floor(Date.now() / 1000)
        };
        
        const chatSubscription = ndk.subscribe(chatFilter, { closeOnEose: false });
        
        chatSubscription.on("event", async (event: NDKEvent) => {
            const author = event.author.pubkey;
            const authorUser = new NDKUser({ pubkey: author });
            const authorNpub = authorUser.npub;
            
            if (config.whitelistedPubkeys.length > 0 && !config.whitelistedPubkeys.includes(author)) {
                console.log(chalk.red(`\n❌ Unauthorized chat event from ${authorNpub}`));
                return;
            }
            
            const projectTag = event.tags.find(tag => tag[0] === "a" && tag[1]?.startsWith("31933:"));
            const timestamp = new Date(event.created_at! * 1000).toLocaleString();
            
            console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
            console.log(chalk.green("💬 New Chat Event Received"));
            console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
            console.log(chalk.gray("Time:       ") + chalk.white(timestamp));
            console.log(chalk.gray("From:       ") + chalk.white(authorNpub));
            console.log(chalk.gray("Project:    ") + chalk.cyan(projectTag?.[1] || "<no project>"));
            console.log(chalk.gray("Message:    ") + chalk.white(event.content.substring(0, 80) + (event.content.length > 80 ? "..." : "")));
            console.log(chalk.gray("Event ID:   ") + chalk.gray(event.id));
            console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
            
            await handleChatEvent(event, config, ndk);
        });
        
        // Also subscribe to kind:1111 replies
        console.log(chalk.cyan("\n💬 Listening for chat replies (kind: " + CHAT_REPLY_KIND + ") from whitelisted pubkeys...\n"));
        
        const chatReplyFilter: NDKFilter = {
            kinds: [CHAT_REPLY_KIND],
            "#K": ["11"],
            authors: config.whitelistedPubkeys.length > 0 ? config.whitelistedPubkeys : undefined,
            since: Math.floor(Date.now() / 1000)
        };
        
        chatReplySubscription = ndk.subscribe(chatReplyFilter, { closeOnEose: false });
        
        chatReplySubscription.on("event", async (event: NDKEvent) => {
            const author = event.author.pubkey;
            const authorUser = new NDKUser({ pubkey: author });
            const authorNpub = authorUser.npub;
            
            if (config.whitelistedPubkeys.length > 0 && !config.whitelistedPubkeys.includes(author)) {
                console.log(chalk.red(`\n❌ Unauthorized chat reply from ${authorNpub}`));
                return;
            }
            
            const rootEventTag = event.tags.find(tag => tag[0] === "E");
            const timestamp = new Date(event.created_at! * 1000).toLocaleString();
            
            console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
            console.log(chalk.green("💬 New Chat Reply Event Received"));
            console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
            console.log(chalk.gray("Time:       ") + chalk.white(timestamp));
            console.log(chalk.gray("From:       ") + chalk.white(authorNpub));
            console.log(chalk.gray("Root Event: ") + chalk.cyan(rootEventTag?.[1] || "<no root event>"));
            console.log(chalk.gray("Message:    ") + chalk.white(event.content.substring(0, 80) + (event.content.length > 80 ? "..." : "")));
            console.log(chalk.gray("Event ID:   ") + chalk.gray(event.id));
            console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
            
            await handleChatEvent(event, config, ndk);
        });
        
        process.on("SIGINT", () => {
            chatSubscription.stop();
            chatReplySubscription.stop();
        });
    } else {
        console.log(chalk.yellow("\n⚠️  Chat command not configured - skipping kind:11 subscription"));
    }

    console.log(chalk.cyan("📡 Starting status event publishing every 60 seconds...\n"));
    
    await publishStatusEvent(ndk, config.whitelistedPubkeys, config.hostname);
    
    const statusInterval = setInterval(async () => {
        await publishStatusEvent(ndk, config.whitelistedPubkeys, config.hostname);
    }, 60000);

    process.on("SIGINT", () => {
        console.log(chalk.yellow("\n\n👋 Shutting down TENEX daemon..."));
        clearInterval(statusInterval);
        commandSubscription.stop();
        taskSubscription.stop();
        if (chatReplySubscription) {
            chatReplySubscription.stop();
        }
        process.exit(0);
    });
}

main().catch(err => {
    console.error(chalk.red("\n❌ Fatal error:"), err);
    process.exit(1);
});