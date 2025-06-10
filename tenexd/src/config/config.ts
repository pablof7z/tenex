import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { mkdirSync } from "fs";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { hostname } from "os";

export interface Config {
    privateKey: string;
    publicKey: string;
    relays: string[];
    whitelistedPubkeys: string[];
    hostname: string;
    projectsPath: string;
    taskCommand: string;
    chatCommand?: string;
}

export class ConfigManager {
    private configPath: string;
    private config: Config | null = null;

    constructor(configPath: string = "./config.json") {
        this.configPath = configPath;
    }

    async load(): Promise<Config> {
        if (existsSync(this.configPath)) {
            const data = readFileSync(this.configPath, "utf-8");
            this.config = JSON.parse(data);
            
            // Validate required fields
            if (!this.config!.projectsPath) {
                throw new Error("Configuration error: 'projectsPath' is required but not set in config.json");
            }
            if (!this.config!.taskCommand) {
                throw new Error("Configuration error: 'taskCommand' is required but not set in config.json");
            }
            
            return this.config!;
        }

        const signer = NDKPrivateKeySigner.generate();
        const privateKey = signer.privateKey;
        const user = await signer.user();
        
        this.config = {
            privateKey: privateKey!,
            publicKey: user.pubkey,
            relays: [
                "wss://relay.damus.io",
                "wss://relay.primal.net",
                "wss://nos.lol",
                "wss://relay.nostr.band"
            ],
            whitelistedPubkeys: [],
            hostname: hostname(),
            projectsPath: "./projects",
            taskCommand: "tenex run --roo",
            chatCommand: undefined
        };

        this.save();
        return this.config;
    }

    save(): void {
        if (!this.config) throw new Error("No configuration loaded");
        
        const dir = dirname(this.configPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        
        writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }

    async getConfig(): Promise<Config> {
        if (!this.config) {
            return await this.load();
        }
        return this.config;
    }

    async addWhitelistedPubkey(pubkey: string): Promise<void> {
        const config = await this.getConfig();
        if (!config.whitelistedPubkeys.includes(pubkey)) {
            config.whitelistedPubkeys.push(pubkey);
            this.save();
        }
    }

    async removeWhitelistedPubkey(pubkey: string): Promise<void> {
        const config = await this.getConfig();
        config.whitelistedPubkeys = config.whitelistedPubkeys.filter(pk => pk !== pubkey);
        this.save();
    }
}