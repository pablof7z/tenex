#!/usr/bin/env bun
import { getAgentSigner } from "./src/utils/agentManager";
import { logger } from "./src/utils/logger";
import fs from "fs/promises";
import path from "path";

async function test() {
    const testProjectPath = path.join(process.cwd(), "test-project");
    
    // Create test project structure
    await fs.mkdir(path.join(testProjectPath, ".tenex"), { recursive: true });
    await fs.writeFile(
        path.join(testProjectPath, ".tenex", "metadata.json"),
        JSON.stringify({ name: "Test Project", title: "Test Project" }, null, 2)
    );
    
    logger.info("Testing getAgentSigner with non-existent default agent...");
    
    try {
        const { signer, agent, isNew } = await getAgentSigner(testProjectPath, "default");
        
        logger.info(`Agent created: ${isNew ? "YES" : "NO"}`);
        logger.info(`Agent name: ${agent.name}`);
        logger.info(`Agent nsec: ${agent.nsec.substring(0, 10)}...`);
        
        // Check if agents.json was created
        const agentsPath = path.join(testProjectPath, ".tenex", "agents.json");
        const agentsContent = await fs.readFile(agentsPath, "utf-8");
        const agents = JSON.parse(agentsContent);
        
        logger.info(`Agents in file: ${Object.keys(agents).join(", ")}`);
        
        // Test again - should not create new
        logger.info("\nTesting getAgentSigner again (should use existing)...");
        const { isNew: isNew2 } = await getAgentSigner(testProjectPath, "default");
        logger.info(`Agent created: ${isNew2 ? "YES" : "NO"}`);
        
        // Clean up
        await fs.rm(testProjectPath, { recursive: true });
        logger.info("\nTest completed successfully!");
        
    } catch (error) {
        logger.error("Test failed:", error);
        // Clean up on error
        await fs.rm(testProjectPath, { recursive: true }).catch(() => {});
    }
}

test();