import type NDK from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { TenexChat } from "./chat.js";
import { ProjectCreator } from "./create-project.js";
import { getNDK, shutdownNDK } from "./ndk-setup.js";
import type { TenexProject, TypingIndicator } from "./types.js";

export class TenexCLI {
    private ndk?: NDK;
    private chat?: TenexChat;
    private project?: TenexProject;

    async start(): Promise<void> {
        logger.info(chalk.blue.bold("🚀 TENEX CLI Client"));
        logger.info(chalk.gray("Connect to TENEX projects via CLI\n"));

        await this.authenticate();
        await this.selectMode();
    }

    private async authenticate(): Promise<void> {
        const nsec = process.env.NSEC;

        if (!nsec) {
            logger.error("❌ NSEC environment variable not found");
            logger.info(chalk.gray("Please set your NSEC: export NSEC=nsec1..."));
            process.exit(1);
        }

        const spinner = ora("Connecting to Nostr network...").start();

        try {
            this.ndk = await getNDK({ nsec });
            spinner.succeed(chalk.green("Connected to Nostr network"));

            const user = this.ndk.activeUser;
            if (user) {
                logger.info(chalk.gray(`Authenticated as: ${user.npub}`));
            }
        } catch (error) {
            spinner.fail(chalk.red("Failed to connect to Nostr"));
            logger.error(error);
            process.exit(1);
        }
    }

    private async selectMode(): Promise<void> {
        const { mode } = await inquirer.prompt([
            {
                type: "list",
                name: "mode",
                message: "What would you like to do?",
                choices: [
                    { name: "💬 Connect to existing project", value: "connect" },
                    { name: "🚀 Create new project", value: "create" },
                    { name: "🚪 Exit", value: "exit" },
                ],
            },
        ]);

        switch (mode) {
            case "connect":
                await this.connectToProject();
                await this.startChatSession();
                break;
            case "create": {
                const creator = new ProjectCreator(this.ndk!);
                await creator.create();
                // After creation, offer to connect to a project
                await this.selectMode();
                break;
            }
            case "exit":
                logger.info(chalk.gray("👋 Goodbye!"));
                await this.ndk?.disconnect();
                process.exit(0);
        }
    }

    private async connectToProject(): Promise<void> {
        let projectNaddr = process.env.PROJECT_NADDR;

        if (!projectNaddr) {
            const { naddr } = await inquirer.prompt([
                {
                    type: "input",
                    name: "naddr",
                    message: "Enter project NADDR:",
                    validate: (input) => input.startsWith("naddr1") || "Invalid NADDR format",
                },
            ]);
            projectNaddr = naddr;
        }

        const spinner = ora("Fetching project details...").start();

        try {
            const projectEvent = await this.ndk!.ndk.fetchEvent(projectNaddr);

            if (!projectEvent) {
                throw new Error("Project not found");
            }

            const title =
                projectEvent.tags.find((tag) => tag[0] === "title")?.[1] || "Unknown Project";
            const dTag = projectEvent.tags.find((tag) => tag[0] === "d")?.[1] || "";

            this.project = {
                naddr: projectNaddr,
                pubkey: projectEvent.pubkey,
                identifier: dTag,
                title: title,
            };

            spinner.succeed(chalk.green(`Connected to project: ${this.project.title}`));

            this.chat = new TenexChat(this.ndk!, this.project);
            await this.chat.discoverAgents();
        } catch (error) {
            spinner.fail(chalk.red("Failed to connect to project"));
            logger.error(error);
            process.exit(1);
        }
    }

    private async startChatSession(): Promise<void> {
        const agents = this.chat!.getSession().agents;

        if (agents.length === 0) {
            logger.info(chalk.yellow("⚠️  No agents discovered. Continuing anyway..."));
        }

        while (true) {
            const { action } = await inquirer.prompt([
                {
                    type: "list",
                    name: "action",
                    message: "What would you like to do?",
                    choices: [
                        { name: "📝 Start new thread", value: "new_thread" },
                        {
                            name: "💬 Reply to current thread",
                            value: "reply",
                            disabled: !this.chat!.getSession().currentThread,
                        },
                        { name: "📋 Show current session", value: "show_session" },
                        { name: "🚪 Exit", value: "exit" },
                    ],
                },
            ]);

            switch (action) {
                case "new_thread":
                    await this.createNewThread();
                    break;
                case "reply":
                    await this.replyToThread();
                    break;
                case "show_session":
                    this.showSession();
                    break;
                case "exit":
                    logger.info(chalk.gray("👋 Goodbye!"));
                    await this.ndk?.disconnect();
                    process.exit(0);
            }
        }
    }

    private async createNewThread(): Promise<void> {
        const { title } = await inquirer.prompt([
            {
                type: "input",
                name: "title",
                message: "Thread title:",
                validate: (input) => input.length > 0 || "Title is required",
            },
        ]);

        const { content } = await inquirer.prompt([
            {
                type: "input",
                name: "content",
                message: "Thread content (use @agent to mention agents):",
            },
        ]);

        const { cleanContent, mentionedAgents } = this.chat!.extractMentions(content);

        const spinner = ora("Creating thread...").start();

        try {
            const threadEvent = await this.chat!.createThread(title, cleanContent, mentionedAgents);
            spinner.succeed(chalk.green(`Thread created: ${title}`));

            if (mentionedAgents.length > 0) {
                logger.info(chalk.gray(`Mentioned agents: ${mentionedAgents.join(", ")}`));
            }

            await this.startListening(threadEvent.id);
        } catch (error) {
            spinner.fail(chalk.red("Failed to create thread"));
            logger.error(error);
        }
    }

    private async replyToThread(): Promise<void> {
        const { content } = await inquirer.prompt([
            {
                type: "input",
                name: "content",
                message: "Reply content (use @agent to mention agents):",
            },
        ]);

        const { cleanContent, mentionedAgents } = this.chat!.extractMentions(content);

        const spinner = ora("Sending reply...").start();

        try {
            await this.chat!.replyToThread(cleanContent, mentionedAgents);
            spinner.succeed(chalk.green("Reply sent"));

            if (mentionedAgents.length > 0) {
                logger.info(chalk.gray(`Mentioned agents: ${mentionedAgents.join(", ")}`));
            }
        } catch (error) {
            spinner.fail(chalk.red("Failed to send reply"));
            logger.error(error);
        }
    }

    private async startListening(threadId: string): Promise<void> {
        logger.info(chalk.blue("\n👂 Listening for responses..."));
        logger.info(chalk.gray("Press Ctrl+C to stop listening\n"));

        await this.chat!.subscribeToThread(threadId, (event) => {
            const timestamp = new Date(event.created_at! * 1000).toLocaleTimeString();
            const agentName =
                this.chat!.getSession().agents.find((a) => a.pubkey === event.pubkey)?.name ||
                "Unknown";

            logger.info(chalk.green(`\n[${timestamp}] ${agentName}:`));
            logger.info(event.content);
        });

        await this.chat!.subscribeToTypingIndicators(threadId, (indicator: TypingIndicator) => {
            if (indicator.kind === 24111) {
                let typingMsg = chalk.yellow(`⌨️  ${indicator.agentName} is typing...`);

                if (indicator.userPrompt) {
                    typingMsg += chalk.gray(
                        `\n   Processing: "${indicator.userPrompt.substring(0, 100)}${indicator.userPrompt.length > 100 ? "..." : ""}"`
                    );
                }

                logger.info(typingMsg);
            } else {
                logger.info(chalk.gray(`✋ ${indicator.agentName} stopped typing`));
            }
        });

        process.on("SIGINT", () => {
            logger.info(chalk.gray("\n👋 Stopped listening"));
            process.exit(0);
        });
    }

    private showSession(): void {
        const session = this.chat!.getSession();

        logger.info(chalk.blue("\n📋 Current Session"));
        logger.info(chalk.gray("=".repeat(50)));
        logger.info(`Project: ${session.project.title || session.project.identifier}`);
        logger.info(`NADDR: ${session.project.naddr}`);
        logger.info(`Agents: ${session.agents.map((a) => a.name).join(", ")}`);

        if (session.currentThread) {
            logger.info(`Current Thread: ${session.currentThread.title}`);
        }

        const typingCount = session.typingIndicators.size;
        if (typingCount > 0) {
            logger.info(
                `Typing: ${Array.from(session.typingIndicators.values())
                    .map((t) => t.agentName)
                    .join(", ")}`
            );
        }

        logger.info(chalk.gray(`${"=".repeat(50)}\n`));
    }
}
