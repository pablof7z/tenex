import type NDK from "@nostr-dev-kit/ndk";
import { NDKEvent, type NDKFilter, NDKProject, NDKProjectTemplate } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { logger } from "@tenex/shared";
import { NDKAgent } from "./events/agent.js";
import { NDKLLMRule } from "./events/instruction.js";

interface ProjectFormData {
    name: string;
    description: string;
    hashtags: string;
    repoUrl?: string;
    imageUrl?: string;
    selectedTemplate?: NDKProjectTemplate;
    selectedAgents?: NDKAgent[];
    selectedInstructions?: InstructionWithAgents[];
}

interface InstructionWithAgents extends NDKLLMRule {
    assignedAgents?: string[];
}

const TEMPLATE_KIND = 30717;

export class ProjectCreator {
    constructor(private ndk: NDK) {}

    async create(): Promise<void> {
        logger.info(chalk.blue.bold("\n🚀 Create New TENEX Project"));
        logger.info(chalk.gray("Follow the steps to create your project\n"));

        const formData: ProjectFormData = {
            name: "",
            description: "",
            hashtags: "",
        };

        // Step 1: Project Details
        await this.getProjectDetails(formData);

        // Step 2: Template Selection (optional)
        if (!formData.repoUrl) {
            await this.selectTemplate(formData);
        }

        // Step 3: Agent Selection
        await this.selectAgents(formData);

        // Step 4: Instruction Selection
        await this.selectInstructions(formData);

        // Step 5: Confirm and Create
        await this.confirmAndCreate(formData);
    }

    private async getProjectDetails(formData: ProjectFormData): Promise<void> {
        logger.info(chalk.yellow("\n📝 Step 1: Project Details"));

        const answers = await inquirer.prompt([
            {
                type: "input",
                name: "name",
                message: "Project name:",
                validate: (input) => input.trim().length > 0 || "Project name is required",
            },
            {
                type: "input",
                name: "description",
                message: "Project description:",
                default: "",
            },
            {
                type: "input",
                name: "hashtags",
                message: "Hashtags (comma-separated):",
                default: "",
            },
            {
                type: "input",
                name: "repoUrl",
                message: "Git repository URL (optional):",
                default: "",
            },
            {
                type: "input",
                name: "imageUrl",
                message: "Project image URL (optional):",
                default: "",
            },
        ]);

        Object.assign(formData, answers);
    }

    private async selectTemplate(formData: ProjectFormData): Promise<void> {
        logger.info(chalk.yellow("\n📋 Step 2: Choose Template (optional)"));

        const { useTemplate } = await inquirer.prompt([
            {
                type: "confirm",
                name: "useTemplate",
                message: "Would you like to use a project template?",
                default: false,
            },
        ]);

        if (!useTemplate) return;

        const spinner = ora("Fetching available templates...").start();

        try {
            const filters: NDKFilter[] = [{ kinds: [TEMPLATE_KIND], limit: 100 }];
            const templateEvents = await this.ndk.fetchEvents(filters);
            spinner.stop();

            if (templateEvents.size === 0) {
                logger.info(chalk.yellow("No templates found. Continuing without template."));
                return;
            }

            const templates = Array.from(templateEvents).map((event) => {
                const template = new NDKProjectTemplate(this.ndk, event);
                const title = template.tagValue("title") || "Untitled Template";
                const description = template.tagValue("description") || "";
                return {
                    name: `${title} - ${description}`.substring(0, 80),
                    value: template,
                };
            });

            const { selectedTemplate } = await inquirer.prompt([
                {
                    type: "list",
                    name: "selectedTemplate",
                    message: "Select a template:",
                    choices: templates,
                },
            ]);

            formData.selectedTemplate = selectedTemplate;
        } catch (error) {
            spinner.fail(chalk.red("Failed to fetch templates"));
            logger.error(error);
        }
    }

    private async selectAgents(formData: ProjectFormData): Promise<void> {
        logger.info(chalk.yellow("\n🤖 Step 3: Select Agents"));

        const spinner = ora("Fetching available agents...").start();

        try {
            const filters: NDKFilter[] = [{ kinds: [NDKAgent.kind], limit: 100 }];
            const agentEvents = await this.ndk.fetchEvents(filters);
            spinner.stop();

            if (agentEvents.size === 0) {
                logger.info(chalk.yellow("No agents found. You can add agents later."));
                return;
            }

            const agents = Array.from(agentEvents).map((event) => {
                const agent = NDKAgent.from(event);
                const name = agent.name || "Unnamed Agent";
                const description = agent.description || agent.role || "";
                return {
                    name: `${name} - ${description}`.substring(0, 80),
                    value: agent,
                };
            });

            const { selectedAgents } = await inquirer.prompt([
                {
                    type: "checkbox",
                    name: "selectedAgents",
                    message: "Select agents for your project:",
                    choices: agents,
                },
            ]);

            formData.selectedAgents = selectedAgents;
        } catch (error) {
            spinner.fail(chalk.red("Failed to fetch agents"));
            logger.error(error);
        }
    }

    private async selectInstructions(formData: ProjectFormData): Promise<void> {
        logger.info(chalk.yellow("\n📚 Step 4: Select Instructions"));

        const spinner = ora("Fetching available instructions...").start();

        try {
            const filters: NDKFilter[] = [{ kinds: [NDKLLMRule.kind], limit: 100 }];
            const instructionEvents = await this.ndk.fetchEvents(filters);
            spinner.stop();

            if (instructionEvents.size === 0) {
                logger.info(chalk.yellow("No instructions found. You can add instructions later."));
                return;
            }

            const instructions = Array.from(instructionEvents).map((event) => {
                const instruction = NDKLLMRule.from(event);
                const title = instruction.title || "Untitled Instruction";
                const description = instruction.description || "";
                return {
                    name: `${title} - ${description}`.substring(0, 80),
                    value: instruction,
                };
            });

            const { selectedInstructions } = await inquirer.prompt([
                {
                    type: "checkbox",
                    name: "selectedInstructions",
                    message: "Select instruction sets for your project:",
                    choices: instructions,
                },
            ]);

            // For each selected instruction, ask which agents should follow it
            const instructionsWithAgents: InstructionWithAgents[] = [];

            for (const instruction of selectedInstructions) {
                if (formData.selectedAgents && formData.selectedAgents.length > 0) {
                    const agentChoices = formData.selectedAgents.map((agent) => ({
                        name: agent.name,
                        value: agent.name,
                    }));

                    const { assignToAll } = await inquirer.prompt([
                        {
                            type: "confirm",
                            name: "assignToAll",
                            message: `Assign "${instruction.title}" to all agents?`,
                            default: true,
                        },
                    ]);

                    let assignedAgents: string[] = [];

                    if (!assignToAll) {
                        const { selectedAgentNames } = await inquirer.prompt([
                            {
                                type: "checkbox",
                                name: "selectedAgentNames",
                                message: `Select agents for "${instruction.title}":`,
                                choices: agentChoices,
                            },
                        ]);
                        assignedAgents = selectedAgentNames;
                    }

                    const instructionWithAgents = Object.assign(
                        Object.create(Object.getPrototypeOf(instruction)),
                        instruction,
                        { assignedAgents: assignToAll ? [] : assignedAgents }
                    ) as InstructionWithAgents;
                    instructionsWithAgents.push(instructionWithAgents);
                } else {
                    const instructionWithAgents = Object.assign(
                        Object.create(Object.getPrototypeOf(instruction)),
                        instruction,
                        { assignedAgents: [] }
                    ) as InstructionWithAgents;
                    instructionsWithAgents.push(instructionWithAgents);
                }
            }

            formData.selectedInstructions = instructionsWithAgents;
        } catch (error) {
            spinner.fail(chalk.red("Failed to fetch instructions"));
            logger.error(error);
        }
    }

    private async confirmAndCreate(formData: ProjectFormData): Promise<void> {
        logger.info(chalk.yellow("\n✅ Step 5: Confirm & Create"));

        // Display summary
        logger.info(chalk.blue("\n📊 Project Summary:"));
        logger.info(`Name: ${chalk.white(formData.name)}`);
        logger.info(`Description: ${chalk.white(formData.description || "None")}`);
        logger.info(`Hashtags: ${chalk.white(formData.hashtags || "None")}`);
        logger.info(`Repository: ${chalk.white(formData.repoUrl || "None")}`);
        logger.info(`Image: ${chalk.white(formData.imageUrl || "None")}`);

        if (formData.selectedTemplate) {
            logger.info(
                `Template: ${chalk.white(formData.selectedTemplate.tagValue("title") || "Selected")}`
            );
        }

        if (formData.selectedAgents && formData.selectedAgents.length > 0) {
            logger.info(
                `Agents (${formData.selectedAgents.length}): ${chalk.white(
                    formData.selectedAgents.map((a) => a.name).join(", ")
                )}`
            );
        }

        if (formData.selectedInstructions && formData.selectedInstructions.length > 0) {
            logger.info(
                `Instructions (${formData.selectedInstructions.length}): ${chalk.white(
                    formData.selectedInstructions.map((i) => i.title || "Untitled").join(", ")
                )}`
            );
        }

        const { confirm } = await inquirer.prompt([
            {
                type: "confirm",
                name: "confirm",
                message: "Create this project?",
                default: true,
            },
        ]);

        if (!confirm) {
            logger.info(chalk.gray("Project creation cancelled."));
            return;
        }

        const spinner = ora("Creating project...").start();

        try {
            const project = new NDKProject(this.ndk);

            // Set basic project properties
            project.title = formData.name.trim();
            project.content =
                formData.description.trim() || `A new TENEX project: ${formData.name}`;

            // Add hashtags
            if (formData.hashtags.trim()) {
                const hashtagArray = formData.hashtags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter((tag) => tag.length > 0);
                project.hashtags = hashtagArray;
            }

            // Set optional properties
            if (formData.repoUrl?.trim()) {
                project.repo = formData.repoUrl.trim();
            }

            if (formData.imageUrl?.trim()) {
                project.picture = formData.imageUrl.trim();
            }

            // Add template reference
            if (formData.selectedTemplate) {
                project.tags.push(["template", formData.selectedTemplate.tagId()]);
            }

            // Add agent references
            if (formData.selectedAgents && formData.selectedAgents.length > 0) {
                for (const agent of formData.selectedAgents) {
                    project.tags.push(["agent", agent.id]);
                }
            }

            // Add instruction references
            if (formData.selectedInstructions && formData.selectedInstructions.length > 0) {
                for (const instruction of formData.selectedInstructions) {
                    if (instruction.assignedAgents && instruction.assignedAgents.length > 0) {
                        // Add rule tag with agent names
                        project.tags.push(["rule", instruction.id, ...instruction.assignedAgents]);
                    } else {
                        // Add rule tag for all agents
                        project.tags.push(["rule", instruction.id]);
                    }
                }
            }

            // Publish the project
            await project.publish();

            spinner.succeed(chalk.green("Project created successfully!"));
            logger.info(chalk.gray(`\nProject ID: ${project.dTag}`));
            logger.info(chalk.gray(`NADDR: ${project.encode()}`));
        } catch (error) {
            spinner.fail(chalk.red("Failed to create project"));
            logger.error(error);
        }
    }
}
