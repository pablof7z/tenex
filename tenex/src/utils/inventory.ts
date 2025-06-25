import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/utils/logger";
import { getProjectContext, isProjectContextInitialized, configService } from "@/services";
import { loadLLMRouter } from "@/llm";
import { Message } from "multi-llm-ts";
import { generateRepomixOutput } from "./repomix.js";

const DEFAULT_INVENTORY_PATH = "context/INVENTORY.md";

interface ComplexModule {
  name: string;
  path: string;
  reason: string;
  suggestedFilename: string;
}

interface ComplexModulesResponse {
  complexModules: ComplexModule[];
}

interface InventoryResult {
  content: string;
  complexModules: ComplexModule[];
}

/**
 * Generate comprehensive inventory using repomix + LLM
 */
export async function generateInventory(projectPath: string): Promise<void> {
  logger.info("Generating project inventory with repomix + LLM", { projectPath });

  const inventoryPath = await getInventoryPath(projectPath);
  
  // Ensure context directory exists
  await fs.mkdir(path.dirname(inventoryPath), { recursive: true });

  // Step 1: Generate repomix content once for efficiency
  const repomixResult = await generateRepomixOutput(projectPath);
  
  try {
    // Step 2: Generate main inventory with complex module identification
    const inventoryResult = await generateMainInventory(projectPath, repomixResult.content);
    
    // Step 3: Save main inventory
    await fs.writeFile(inventoryPath, inventoryResult.content, "utf-8");
    logger.info("Main inventory saved", { inventoryPath });

    // Step 4: Generate individual module guides for complex modules (max 10)
    const modulesToProcess = inventoryResult.complexModules.slice(0, 10);
    
    for (const module of modulesToProcess) {
      try {
        await generateModuleGuide(projectPath, module, repomixResult.content);
      } catch (error) {
        logger.warn("Failed to generate module guide", { 
          module: module.name, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    logger.info("Inventory generation completed", { 
      inventoryPath,
      complexModules: modulesToProcess.length 
    });
  } finally {
    repomixResult.cleanup();
  }
}

/**
 * Generate main inventory and identify complex modules
 */
async function generateMainInventory(projectPath: string, repomixContent: string): Promise<InventoryResult> {
  logger.debug("Generating main inventory");
  const prompt = `You are analyzing a codebase to create a comprehensive inventory. Here is the complete repository content in XML format from repomix:

<repository>
${repomixContent}
</repository>

Please generate a comprehensive inventory in markdown format that includes:

1. **Project Overview**
   - Brief description of what the project does
   - Main technologies and frameworks used
   - Architecture style (if identifiable)

2. **Directory Structure**
   - High-level directory breakdown with purpose of each
   - Key organizational patterns

3. **Significant Files**
   - List of important files with one-line value propositions
   - Focus on entry points, core business logic, configurations
   - Include file paths and brief descriptions

4. **Architectural Insights**
   - Key patterns used in the codebase
   - Data flow and integration points
   - Notable design decisions

5. **High-Complexity Modules** (if any)
   - Identify modules/components that are particularly complex
   - For each complex module, provide: name, file path, reason for complexity

At the end, if you identified any high-complexity modules, provide them in this JSON format:
\`\`\`json
{
  "complexModules": [
    {
      "name": "Module Name",
      "path": "src/path/to/module",
      "reason": "Brief explanation of complexity",
      "suggestedFilename": "MODULE_NAME_GUIDE.md"
    }
  ]
}
\`\`\`

Make the inventory comprehensive but readable, focusing on helping developers quickly understand the codebase structure and purpose.`;

  const llmRouter = await loadLLMRouter(projectPath);
  const userMessage = new Message("user", prompt);
  const response = await llmRouter.complete({
    messages: [userMessage],
    options: {
      temperature: 0.3,
      maxTokens: 4000,
      configName: "defaults.analyze",
    },
  });

  const content = response.content || "";
  
  // Extract complex modules from JSON at the end
  const complexModules = await extractComplexModules(content, projectPath);
  
  return {
    content,
    complexModules
  };
}

/**
 * Generate detailed guide for a specific complex module
 */
async function generateModuleGuide(projectPath: string, module: ComplexModule, repomixContent: string): Promise<void> {
  logger.debug("Generating module guide", { module: module.name });
  
  const prompt = `You are analyzing a specific complex module in a codebase. Here is the complete repository content in XML format from repomix:

<repository>
${repomixContent}
</repository>

Focus specifically on the module: **${module.name}** at path: \`${module.path}\`

This module was identified as complex because: ${module.reason}

Please generate a comprehensive technical guide for this module that includes:

1. **Module Overview**
   - Purpose and responsibilities
   - Key interfaces and entry points
   - Dependencies and relationships

2. **Technical Architecture**
   - Internal structure and organization
   - Key classes/functions and their roles
   - Data flow within the module

3. **Implementation Details**
   - Core algorithms or business logic
   - Important patterns or design decisions
   - Configuration and customization points

4. **Integration Points**
   - How other parts of the system interact with this module
   - External dependencies
   - Event flows or communication patterns

5. **Complexity Analysis**
   - What makes this module complex
   - Potential areas for improvement
   - Common pitfalls or gotchas

Focus on technical depth while keeping it accessible to developers who need to work with or modify this module.`;

  const llmRouter = await loadLLMRouter(projectPath);
  const userMessage = new Message("user", prompt);
  const response = await llmRouter.complete({
    messages: [userMessage],
    options: {
      temperature: 0.3,
      maxTokens: 6000,
      configName: "defaults.analyze",
    },
  });

  // Save module guide
  const inventoryPath = await getInventoryPath(projectPath);
  const contextDir = path.dirname(inventoryPath);
  const guideFilePath = path.join(contextDir, module.suggestedFilename);
  
  await fs.writeFile(guideFilePath, response.content || "", "utf-8");
  logger.info("Module guide saved", { 
    module: module.name, 
    guideFilePath 
  });
}

/**
 * Type guard to validate complex modules response structure
 */
function isComplexModulesResponse(data: unknown): data is ComplexModulesResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  if (!Array.isArray(obj.complexModules)) {
    return false;
  }
  
  return obj.complexModules.every((module: unknown) => {
    if (typeof module !== 'object' || module === null) {
      return false;
    }
    
    const mod = module as Record<string, unknown>;
    return (
      typeof mod.name === 'string' &&
      typeof mod.path === 'string' &&
      typeof mod.reason === 'string' &&
      typeof mod.suggestedFilename === 'string'
    );
  });
}

/**
 * Extract complex modules from LLM response with fallback mechanism
 */
async function extractComplexModules(content: string, projectPath?: string): Promise<ComplexModule[]> {
  try {
    // Look for JSON block at the end
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      logger.debug("No JSON block found in response, trying fallback extraction");
      return projectPath ? await fallbackExtractComplexModules(content, projectPath) : [];
    }

    const jsonString = jsonMatch[1];
    if (!jsonString) {
      logger.warn("Empty JSON match found");
      return projectPath ? await fallbackExtractComplexModules(content, projectPath) : [];
    }
    
    const jsonData = JSON.parse(jsonString) as unknown;
    
    // Type guard to validate the structure
    if (isComplexModulesResponse(jsonData)) {
      return jsonData.complexModules;
    }
    
    logger.warn("Invalid JSON structure for complex modules");
    return [];
  } catch (error) {
    logger.warn("Failed to extract complex modules from JSON, trying fallback", { error });
    return projectPath ? await fallbackExtractComplexModules(content, projectPath) : [];
  }
}

/**
 * Fallback mechanism for JSON extraction using a cleanup LLM call
 */
async function fallbackExtractComplexModules(content: string, projectPath?: string): Promise<ComplexModule[]> {
  if (!projectPath) {
    logger.warn("No project path provided for fallback extraction");
    return [];
  }

  try {
    const cleanupPrompt = `Extract only the valid JSON array of complex modules from the following text and nothing else. If no JSON is present or no complex modules are mentioned, return an empty array [].

Response format should be exactly:
\`\`\`json
{
  "complexModules": [
    {
      "name": "Module Name", 
      "path": "src/path/to/module",
      "reason": "Brief explanation",
      "suggestedFilename": "MODULE_NAME_GUIDE.md"
    }
  ]
}
\`\`\`

Text to analyze:
${content}`;

    const llmRouter = await loadLLMRouter(projectPath);
    const userMessage = new Message("user", cleanupPrompt);
    const response = await llmRouter.complete({
      messages: [userMessage],
      options: {
        temperature: 0.1,
        maxTokens: 1000,
        configName: "defaults.analyze",
      },
    });

    const fallbackContent = response.content || "";
    const jsonMatch = fallbackContent.match(/```json\s*\n([\s\S]*?)\n```/);
    
    if (jsonMatch) {
      const jsonString = jsonMatch[1];
      if (!jsonString) {
        logger.warn("Empty JSON match found in fallback");
        return [];
      }
      
      const jsonData = JSON.parse(jsonString) as unknown;
      
      // Type guard to validate the structure
      if (isComplexModulesResponse(jsonData)) {
        return jsonData.complexModules;
      }
      
      logger.warn("Invalid JSON structure in fallback extraction");
    }
    
    return [];
  } catch (error) {
    logger.warn("Fallback extraction failed", { error });
    return [];
  }
}

/**
 * Update inventory for specific files (placeholder for future implementation)
 */
export async function updateInventory(projectPath: string, files: string[]): Promise<void> {
  logger.info("Updating inventory", { projectPath, files });
  // For now, just regenerate the full inventory
  // Future optimization: implement partial updates
  await generateInventory(projectPath);
}

/**
 * Check if inventory exists
 */
export async function inventoryExists(projectPath: string): Promise<boolean> {
  try {
    const inventoryPath = await getInventoryPath(projectPath);
    await fs.access(inventoryPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load inventory content for system prompts
 */
export async function loadInventoryContent(projectPath: string): Promise<string | null> {
  try {
    const inventoryPath = await getInventoryPath(projectPath);
    const content = await fs.readFile(inventoryPath, "utf-8");
    return content;
  } catch (error) {
    logger.debug("Failed to load inventory content", { error });
    return null;
  }
}

/**
 * Get the inventory file path
 */
async function getInventoryPath(projectPath: string): Promise<string> {
  const projectConfig = await loadProjectConfig(projectPath);
  const inventoryPath = projectConfig?.paths?.inventory || DEFAULT_INVENTORY_PATH;
  return path.join(projectPath, inventoryPath);
}

/**
 * Load project configuration
 */
async function loadProjectConfig(projectPath: string) {
  try {
    if (isProjectContextInitialized()) {
      // Get config from ProjectContext if available
      const projectCtx = getProjectContext();
      const project = projectCtx.project;
      const titleTag = project.tags.find((tag) => tag[0] === "title");
      return {
        paths: { inventory: DEFAULT_INVENTORY_PATH },
        title: titleTag?.[1] || "Untitled Project",
      };
    }
    // Fallback: try to load config directly
    const { config } = await configService.loadConfig(projectPath);
    return config;
  } catch (error) {
    logger.debug("Failed to load project config", { error });
    return { paths: { inventory: DEFAULT_INVENTORY_PATH } };
  }
}