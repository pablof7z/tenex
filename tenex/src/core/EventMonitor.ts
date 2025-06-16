import fs from "node:fs/promises";
import path from "node:path";
import type { NDKEvent, NDKFilter, NDKSubscription } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { getRelayUrls, logger } from "@tenex/shared";
import type { LLMConfig, LLMConfigs } from "@tenex/types";
import { nip19 } from "nostr-tools";
import type { IProcessManager } from "./ProcessManager";
import type { IProjectManager } from "./ProjectManager";

export interface IEventMonitor {
    start(whitelistedPubkeys: string[], llmConfigs?: LLMConfig[]): Promise<void>;
    stop(): Promise<void>;
}

export class EventMonitor implements IEventMonitor {
    private subscription: NDKSubscription | null = null;
    private whitelistedPubkeys: Set<string> = new Set();
    private llmConfigs: LLMConfig[] = [];

    constructor(
        private ndk: NDK,
        private projectManager: IProjectManager,
        private processManager: IProcessManager
    ) {}

    async start(whitelistedPubkeys: string[], llmConfigs?: LLMConfig[]): Promise<void> {
        this.whitelistedPubkeys = new Set(whitelistedPubkeys);
        this.llmConfigs = llmConfigs || [];

        logger.info("Starting event monitor", {
            whitelistedCount: whitelistedPubkeys.length,
        });

        // Subscribe to all events from whitelisted pubkeys
        const filter: NDKFilter = {
            authors: whitelistedPubkeys,
            since: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
        };

        this.subscription = this.ndk.subscribe(filter, {
            closeOnEose: false,
            groupable: false,
        });

        this.subscription.on("event", (event: NDKEvent) => {
            this.handleEvent(event).catch((error) => {
                logger.error("Error handling event", { error, event: event.id });
            });
        });

        logger.info("Event monitor started");
    }

    async stop(): Promise<void> {
        logger.info("Stopping event monitor");

        if (this.subscription) {
            this.subscription.stop();
            this.subscription = null;
        }

        logger.info("Event monitor stopped");
    }

    private async handleEvent(event: NDKEvent): Promise<void> {
        // Check if event is from whitelisted pubkey
        if (!this.whitelistedPubkeys.has(event.pubkey)) {
            return;
        }

        // Check if event has project "a" tag
        const projectTag = this.getProjectTag(event);
        if (!projectTag) {
            return;
        }

        const projectIdentifier = this.extractProjectIdentifier(projectTag);
        if (!projectIdentifier) {
            return;
        }

        logger.info("Received project event", {
            eventId: event.id,
            kind: event.kind,
            projectIdentifier,
            pubkey: event.pubkey,
        });

        // Check if project is already running
        if (await this.processManager.isProjectRunning(projectIdentifier)) {
            logger.debug("Project already running", { projectIdentifier });
            return;
        }

        // Ensure project exists and get path
        try {
            const naddr = this.reconstructNaddr(projectTag, event.pubkey);
            const projectPath = await this.projectManager.ensureProjectExists(
                projectIdentifier,
                naddr,
                this.ndk
            );

            // Initialize llms.json if it doesn't exist and we have LLM configs
            await this.initializeLLMConfig(projectPath);

            // Spawn project run process
            await this.processManager.spawnProjectRun(projectPath, projectIdentifier);

            logger.info("Started project process", {
                projectIdentifier,
                projectPath,
            });
        } catch (error) {
            logger.error("Failed to start project", {
                error,
                projectIdentifier,
            });
        }
    }

    private getProjectTag(event: NDKEvent): string | undefined {
        const aTag = event.tags.find((tag) => tag[0] === "a");
        return aTag ? aTag[1] : undefined;
    }

    private extractProjectIdentifier(aTag: string): string | undefined {
        // Format: kind:pubkey:identifier
        const parts = aTag.split(":");
        if (parts.length >= 3) {
            return parts[2];
        }
        return undefined;
    }

    private reconstructNaddr(aTag: string, eventPubkey: string): string {
        // Parse the a tag to get project details
        const parts = aTag.split(":");
        if (parts.length < 3) {
            throw new Error("Invalid project a tag format");
        }

        const [kind, pubkey, identifier] = parts;

        // Use the pubkey from the a tag if available, otherwise use event pubkey
        const projectPubkey = pubkey || eventPubkey;

        // Encode as naddr
        return nip19.naddrEncode({
            identifier,
            pubkey: projectPubkey,
            kind: Number.parseInt(kind, 10),
        });
    }

    private async initializeLLMConfig(projectPath: string): Promise<void> {
        const llmsPath = path.join(projectPath, ".tenex", "llms.json");

        try {
            // Check if llms.json already exists
            await fs.access(llmsPath);
            logger.debug("llms.json already exists", { projectPath });
        } catch {
            // File doesn't exist, create it if we have LLM configs
            if (this.llmConfigs.length > 0) {
                logger.info("Creating llms.json from daemon configuration", { projectPath });

                const llmsConfig: LLMConfigs = {};

                // Add each LLM config with a key based on provider and model
                for (let i = 0; i < this.llmConfigs.length; i++) {
                    const config = this.llmConfigs[i];
                    const key =
                        i === 0
                            ? "default"
                            : `${config.provider}-${config.model}`
                                  .toLowerCase()
                                  .replace(/[^a-z0-9-]/g, "-");
                    llmsConfig[key] = config;
                }

                // Set the default key to point to the first config
                if (this.llmConfigs.length > 0) {
                    llmsConfig.default = "default";
                }

                await fs.writeFile(llmsPath, JSON.stringify(llmsConfig, null, 2), "utf-8");
                logger.info("Created llms.json with daemon LLM configurations", {
                    projectPath,
                    configCount: this.llmConfigs.length,
                });
            } else {
                logger.warn("No LLM configurations available from daemon", { projectPath });
            }
        }
    }
}
