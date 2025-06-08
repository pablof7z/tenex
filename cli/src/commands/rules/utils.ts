import fs from "fs";
import path from "path";
import { logger } from "../../utils/logger";
import type { RuleData } from "./types";

export function getRulesDirectory(projectPath: string, agent?: string): string {
    const baseDir = path.join(projectPath, ".tenex", "rules");
    if (agent) {
        return path.join(baseDir, agent);
    }
    return baseDir;
}

export function ensureRulesDirectory(projectPath: string, agent?: string): void {
    const rulesDir = getRulesDirectory(projectPath, agent);
    if (!fs.existsSync(rulesDir)) {
        fs.mkdirSync(rulesDir, { recursive: true });
        logger.debug(`Created rules directory: ${rulesDir}`);
    }
}

export function saveRule(
    projectPath: string,
    ruleData: RuleData,
    agent?: string
): string {
    ensureRulesDirectory(projectPath, agent);
    const rulesDir = getRulesDirectory(projectPath, agent);

    const sanitizedTitle = ruleData.title.replace(/[^a-z0-9]/gi, "_");
    const filename = `${sanitizedTitle}.json`;
    const filePath = path.join(rulesDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(ruleData, null, 2));
    logger.success(`Rule saved to: ${filePath}`);

    return filePath;
}

export function loadRules(
    projectPath: string,
    agent?: string
): { path: string; data: RuleData }[] {
    const rulesDir = getRulesDirectory(projectPath, agent);
    if (!fs.existsSync(rulesDir)) {
        return [];
    }

    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
    const rules: { path: string; data: RuleData }[] = [];

    for (const file of files) {
        const filePath = path.join(rulesDir, file);
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(content) as RuleData;
            rules.push({ path: filePath, data });
        } catch (error) {
            logger.warn(`Failed to load rule from ${filePath}: ${error}`);
        }
    }

    return rules;
}

export function loadAllRules(projectPath: string): {
    general: { path: string; data: RuleData }[];
    byAgent: Map<string, { path: string; data: RuleData }[]>;
} {
    const generalRules = loadRules(projectPath);
    const byAgent = new Map<string, { path: string; data: RuleData }[]>();

    const rulesBaseDir = getRulesDirectory(projectPath);
    if (fs.existsSync(rulesBaseDir)) {
        const entries = fs.readdirSync(rulesBaseDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const agentRules = loadRules(projectPath, entry.name);
                if (agentRules.length > 0) {
                    byAgent.set(entry.name, agentRules);
                }
            }
        }
    }

    return { general: generalRules, byAgent };
}

export function hasProjectConfig(projectPath: string): boolean {
    const tenexDir = path.join(projectPath, ".tenex");
    return fs.existsSync(tenexDir);
}