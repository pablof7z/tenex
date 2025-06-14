import NDK, { type NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import type { NDKFilter } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { setupAIConfiguration } from "./src/ai/index.js";
import { ConfigManager } from "./src/config/config.js";
import { handleAgentEvent, handleProjectEvent } from "./src/projects/eventHandler.js";
import { ProcessManager } from "./src/utils/processManager.js";

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
            console.error(
                chalk.red(`\n❌ ${err instanceof Error ? err.message : "Invalid input"}`)
            );
            console.log(chalk.yellow("\nPlease try again:"));
            process.stdout.write(chalk.cyan("> "));
        }
    }

    return null;
}

async function main() {
    console.log(chalk.cyan.bold("\n🚀 Starting TENEX Daemon...\n"));

    // Check for pubkey argument
    const args = process.argv.slice(2);
    let pubkeyFromArg: string | null = null;

    // Show help if requested
    if (args.length > 0 && (args[0] === "--help" || args[0] === "-h")) {
        console.log(chalk.yellow("Usage: bun run index.ts [options] [pubkey]"));
        console.log(chalk.gray("\nOptions:"));
        console.log(chalk.gray("  --setup-ai    Configure AI providers (OpenAI, OpenRouter)"));
        console.log(chalk.gray("  --help, -h    Show this help message"));
        console.log(
            chalk.gray("  pubkey        Optional pubkey (npub or hex format) to use as whitelist")
        );
        console.log(
            chalk.gray("                If provided, this overrides the whitelist in config.json")
        );
        console.log(chalk.gray("\nExamples:"));
        console.log(chalk.gray("  bun run index.ts --setup-ai"));
        console.log(
            chalk.gray(
                "  bun run index.ts npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft"
            )
        );
        console.log(
            chalk.gray(
                "  bun run index.ts fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52"
            )
        );
        process.exit(0);
    }

    // Check for --setup-ai flag early
    const setupAiIndex = args.indexOf("--setup-ai");
    const hasSetupAi = setupAiIndex !== -1;

    // Remove --setup-ai from args if present
    if (hasSetupAi) {
        args.splice(setupAiIndex, 1);
    }

    // Now check for pubkey argument
    if (args.length > 0) {
        const input = args[0];
        try {
            if (input.startsWith("npub")) {
                const user = new NDKUser({ npub: input });
                pubkeyFromArg = user.pubkey;
                console.log(chalk.green(`✅ Using pubkey from argument: ${input}`));
            } else if (/^[0-9a-fA-F]{64}$/.test(input)) {
                pubkeyFromArg = input.toLowerCase();
                const user = new NDKUser({ pubkey: pubkeyFromArg });
                console.log(chalk.green(`✅ Using pubkey from argument: ${user.npub}`));
            } else {
                console.error(
                    chalk.red(
                        "❌ Invalid pubkey format. Please provide npub or 64-character hex pubkey"
                    )
                );
                console.error(chalk.gray("Run with --help for usage information"));
                process.exit(1);
            }
        } catch (err) {
            console.error(
                chalk.red(
                    `❌ Error parsing pubkey: ${err instanceof Error ? err.message : "Invalid input"}`
                )
            );
            process.exit(1);
        }
    }

    const configManager = new ConfigManager();
    const config = await configManager.getConfig();

    console.log(chalk.green("✅ Configuration loaded"));

    const ndk = new NDK({
        explicitRelayUrls: config.relays,
    });

    console.log(chalk.yellow("\n🔌 Connecting to relays..."));

    await ndk.connect();

    console.log(chalk.green("✅ Connected to relays:"));
    for (const relay of config.relays) {
        console.log(chalk.gray(`   - ${relay}`));
    }

    // If pubkey was provided as argument, use it as the whitelist
    if (pubkeyFromArg) {
        config.whitelistedPubkeys = [pubkeyFromArg];
        console.log(
            chalk.yellow(
                "\n🔒 Using command-line pubkey as whitelist (ignoring config.json whitelist)"
            )
        );
    } else if (config.whitelistedPubkeys.length === 0) {
        console.log(chalk.yellow("\n⚠️  No whitelisted pubkeys configured."));

        const pubkeyToAdd = await promptForPubkey();

        if (pubkeyToAdd) {
            await configManager.addWhitelistedPubkey(pubkeyToAdd);
            config.whitelistedPubkeys.push(pubkeyToAdd);
            const addedUser = new NDKUser({ pubkey: pubkeyToAdd });
            console.log(chalk.green(`\n✅ Added ${addedUser.npub} to whitelist`));
        } else {
            console.log(
                chalk.yellow("\n⚠️  Running without whitelist - accepting commands from anyone")
            );
        }
    }

    if (config.whitelistedPubkeys.length > 0) {
        console.log(chalk.green("\n🔒 Whitelisted pubkeys:"));
        for (const pk of config.whitelistedPubkeys) {
            const user = new NDKUser({ pubkey: pk });
            console.log(chalk.gray(`   - ${user.npub}`));
        }
    }

    // Check for --setup-ai flag
    if (hasSetupAi) {
        await setupAIConfiguration(configManager);
        process.exit(0);
    }

    // Check if AI is configured
    if (!(await configManager.hasAIConfigurations())) {
        console.log(chalk.yellow("\n⚠️  No AI configurations found."));
        console.log(
            chalk.yellow("AI configuration is required for tenexd to function properly.\n")
        );
        await setupAIConfiguration(configManager);

        // If still no configurations (user skipped), exit
        if (!(await configManager.hasAIConfigurations())) {
            console.log(chalk.red("\n❌ AI configuration is required. Exiting."));
            process.exit(1);
        }
    }

    const updatedConfig = await configManager.getConfig();
    const aiConfigs = updatedConfig.aiConfigurations || [];
    console.log(chalk.green("\n🤖 AI Configurations:"));
    for (const aiConfig of aiConfigs) {
        const isDefault = aiConfig.name === updatedConfig.defaultAIConfiguration;
        console.log(chalk.gray(`   - ${aiConfig.name}${isDefault ? " (default)" : ""}`));
    }

    // Initialize process manager
    const processManager = new ProcessManager(configManager);

    console.log(chalk.cyan("\n👂 Listening for all events from whitelisted pubkeys...\n"));
    console.log(chalk.gray("Events with project 'a' tags will trigger 'tenex run' processes\n"));

    // Subscribe to all events from whitelisted users
    // We'll filter for project tags in the event handler
    const projectEventFilter: NDKFilter = {
        authors: config.whitelistedPubkeys.length > 0 ? config.whitelistedPubkeys : undefined,
        since: Math.floor(Date.now() / 1000),
    };

    const projectEventSubscription = ndk.subscribe(projectEventFilter, {
        closeOnEose: false,
    });

    projectEventSubscription.on("event", async (event: NDKEvent) => {
        // Show incoming event
        const timestamp = new Date().toLocaleTimeString();
        const eventKind = event.kind;
        const author = event.author.pubkey;
        const authorUser = new NDKUser({ pubkey: author });

        console.log(
            chalk.gray(`[${timestamp}] `) +
                chalk.cyan(`Event kind:${eventKind} from ${authorUser.npub.substring(0, 16)}...`)
        );

        // Handle agent configuration events
        if (event.kind === 4199) {
            await handleAgentEvent(event, config);
        }

        // Handle all project-related events
        await handleProjectEvent(event, config, ndk, processManager);
    });

    process.on("SIGINT", () => {
        console.log(chalk.yellow("\n\n👋 Shutting down TENEX daemon..."));
        projectEventSubscription.stop();
        process.exit(0);
    });
}

main().catch((err) => {
    console.error(chalk.red("\n❌ Fatal error:"), err);
    process.exit(1);
});
