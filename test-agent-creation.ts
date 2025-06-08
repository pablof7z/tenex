import { getOrCreateAgentNsec, loadAgentsConfig, saveAgentsConfig } from "./mcp/lib/agents.js";
import path from "path";

async function testAgentSystem() {
    const agentsConfigPath = path.join(__dirname, ".tenex", "agents.json");
    
    console.log("Testing agent system...");
    console.log("Config path:", agentsConfigPath);
    
    // Load current agents
    const agents = await loadAgentsConfig(agentsConfigPath);
    console.log("Current agents:", agents);
    
    // Test creating a new agent
    console.log("\nCreating 'code' agent...");
    const codeAgentNsec = await getOrCreateAgentNsec(agentsConfigPath, "code", "TENEX");
    console.log("Code agent nsec:", codeAgentNsec);
    
    // Load agents again to verify
    const updatedAgents = await loadAgentsConfig(agentsConfigPath);
    console.log("\nUpdated agents:", updatedAgents);
    
    // Test creating another agent
    console.log("\nCreating 'planner' agent...");
    const plannerAgentNsec = await getOrCreateAgentNsec(agentsConfigPath, "planner", "TENEX");
    console.log("Planner agent nsec:", plannerAgentNsec);
    
    // Final check
    const finalAgents = await loadAgentsConfig(agentsConfigPath);
    console.log("\nFinal agents:", finalAgents);
}

testAgentSystem().catch(console.error);