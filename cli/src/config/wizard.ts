/**
 * TENEX CLI: Config Wizard
 * Interactive wizard for login or key creation.
 */
import inquirer from "inquirer";
import fetch from "node-fetch";
import { KeyManager } from "../nostr/keyManager";
import { NDKClient } from "../nostr/ndkClient";
import { TenexConfig } from "../types";
import { logError, logInfo } from "../utils/logger";
import { ConfigManager } from "./manager";

export async function runConfigWizard() {
    logInfo("Welcome to TENEX! Let's set up your configuration.");

    const { action } = await inquirer.prompt([
        {
            type: "list",
            name: "action",
            message: "How would you like to proceed?",
            choices: [
                { name: "Login with existing key", value: "login" },
                { name: "Create new key", value: "create" },
            ],
        },
    ]);

    let nsec: string;

    if (action === "login") {
        while (true) {
            const { inputNsec } = await inquirer.prompt([
                {
                    type: "password",
                    name: "inputNsec",
                    message: "Enter your nsec (private key, starts with 'nsec1'):",
                },
            ]);
            if (KeyManager.validateNsec(inputNsec)) {
                nsec = inputNsec;
                logInfo("nsec validated.");
                break;
            } else {
                logError("Invalid nsec. Please try again.");
            }
        }
    } else {
        // Create new key
        const { name } = await inquirer.prompt([
            {
                type: "input",
                name: "name",
                message: "Enter a name for your profile:",
                validate: (input: string) => input.length > 0 || "Name cannot be empty.",
            },
        ]);
        nsec = KeyManager.generateNsec();
        logInfo("Generated new nsec for your account.");

        // Generate random avatar using dicebear
        const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`;
        logInfo(`Generated avatar: ${avatarUrl}`);

        // Publish profile to Nostr
        try {
            const pubkey = KeyManager.getPubkeyFromNsec(nsec);
            const profileEvent = {
                kind: 0,
                pubkey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify({
                    name,
                    picture: avatarUrl,
                }),
            };
            await NDKClient.publishEvent(nsec, profileEvent as any);
            logInfo("Profile published to Nostr.");
        } catch (err) {
            logError("Failed to publish profile to Nostr: " + err);
        }
    }

    // Save config
    const config: TenexConfig = { user: { nsec } };
    ConfigManager.saveConfig(config);
    logInfo("Configuration saved to ~/.tenex/config");

    // Publish status update to Nostr: initialization complete
    await NDKClient.publishStatusUpdate(nsec, "TENEX CLI initialized.", {
        command: "init",
        method: action,
    });
}
