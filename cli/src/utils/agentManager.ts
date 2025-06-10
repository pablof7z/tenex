import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import path from "path";
import fs from "fs/promises";
import { readFile } from "./file";
import { logger } from "./logger";
import { getNDK } from "../nostr/ndkClient";

interface Agent {
    nsec: string;
    name: string;
    model?: string;
    mcpServers?: string[];
}

interface AgentsConfig {
    [key: string]: Agent;
}

export async function getAgentSigner(
    projectPath: string,
    agentSlug: string = "default"
): Promise<{ signer: NDKPrivateKeySigner; agent: Agent; isNew: boolean }> {
    const agentsPath = path.join(projectPath, ".tenex", "agents.json");
    let agents: AgentsConfig = {};
    let isNew = false;

    try {
        const agentsData = await readFile(agentsPath);
        agents = JSON.parse(agentsData);
    } catch (error) {
        logger.warn("Failed to load agents.json, will create if needed:", error);
    }

    if (!agents[agentSlug]) {
        logger.info(`Agent '${agentSlug}' not found, creating new agent...`);
        isNew = true;

        // Generate new private key using NDK
        const newSigner = NDKPrivateKeySigner.generate();
        const nsec = newSigner.nsec;

        // Get project metadata for naming
        const metadataPath = path.join(projectPath, ".tenex", "metadata.json");
        let projectName = "Project";
        try {
            const metadata = JSON.parse(await readFile(metadataPath));
            projectName = metadata.name || metadata.title || "Project";
        } catch (error) {
            logger.warn("Could not load project metadata:", error);
        }

        // Create agent config
        const agentName = agentSlug === "default" ? projectName : `${agentSlug} @ ${projectName}`;
        agents[agentSlug] = {
            nsec,
            name: agentName,
            model: "claude-3-5-sonnet-20241022"
        };

        // Save updated agents.json
        await fs.mkdir(path.dirname(agentsPath), { recursive: true });
        await fs.writeFile(agentsPath, JSON.stringify(agents, null, 2));
        logger.info(`Created new agent '${agentSlug}' with name '${agentName}'`);

        // Publish kind:0 profile event
        await publishAgentProfile(agents[agentSlug]);
    }

    const agent = agents[agentSlug];
    const signer = new NDKPrivateKeySigner(agent.nsec);

    return { signer, agent, isNew };
}

async function publishAgentProfile(agent: Agent) {
    try {
        const ndk = await getNDK();
        const signer = new NDKPrivateKeySigner(agent.nsec);
        
        const profileEvent = new NDKEvent(ndk);
        profileEvent.kind = 0;
        profileEvent.content = JSON.stringify({
            name: agent.name,
            about: `AI agent powered by ${agent.model || "Claude"}`,
            picture: "https://raw.githubusercontent.com/pablof7z/wiki/refs/heads/main/attachments/robot.webp",
            lud06: "",
            display_name: agent.name
        });

        profileEvent.ndk = ndk;
        await profileEvent.sign(signer);
        await profileEvent.publish();
        
        logger.info(`Published profile for agent '${agent.name}'`);
    } catch (error) {
        logger.error("Failed to publish agent profile:", error);
    }
}

export async function ensureDefaultAgent(projectPath: string): Promise<void> {
    await getAgentSigner(projectPath, "default");
}