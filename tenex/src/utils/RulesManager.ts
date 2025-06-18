import path from "node:path";
import { getNDK } from "@/nostr/ndkClient";
import type { NDKEvent } from "@nostr-dev-kit/ndk";
import * as fileSystem from "@tenex/shared/fs";
import { logError, logInfo } from "@tenex/shared/node";

export interface RuleMapping {
  ruleEventId: string;
  agentNames: string[]; // Empty array means rule applies to all agents
}

export interface CachedRule {
  eventId: string;
  title: string;
  description: string;
  content: string;
  version?: string;
  fetchedAt: number;
}

export class RulesManager {
  private rulesCache: Map<string, CachedRule> = new Map();
  private rulesDir: string;

  constructor(private projectPath: string) {
    this.rulesDir = path.join(projectPath, ".tenex", "rules");
  }

  async initialize(): Promise<void> {
    // Ensure rules directory exists
    await fileSystem.ensureDirectory(this.rulesDir);
  }

  /**
   * Parse rule tags from project event
   */
  parseRuleTags(projectEvent: NDKEvent): RuleMapping[] {
    const ruleMappings: RuleMapping[] = [];

    const ruleTags = projectEvent.tags.filter((tag) => tag[0] === "rule" && tag[1]);

    for (const ruleTag of ruleTags) {
      const [, ruleEventId, ...agentNames] = ruleTag;
      ruleMappings.push({
        ruleEventId: ruleEventId || "",
        agentNames: agentNames || [],
      });
    }

    return ruleMappings;
  }

  /**
   * Fetch and cache rules from Nostr
   */
  async fetchAndCacheRules(ruleMappings: RuleMapping[]): Promise<void> {
    const ruleIds = [...new Set(ruleMappings.map((rm) => rm.ruleEventId))];

    if (ruleIds.length === 0) {
      return;
    }

    // Check cache first
    const uncachedIds: string[] = [];
    for (const ruleId of ruleIds) {
      const cached = await this.loadCachedRule(ruleId);
      if (cached) {
        this.rulesCache.set(ruleId, cached);
      } else {
        uncachedIds.push(ruleId);
      }
    }

    if (uncachedIds.length === 0) {
      return;
    }

    // Fetch uncached rules from Nostr
    const filter = { ids: uncachedIds };

    const events = await getNDK().fetchEvents(filter);

    for (const event of events) {
      await this.cacheRule(event);
    }

    logInfo(`Fetched and cached ${events.size} new rule(s)`);
  }

  /**
   * Cache a rule event to disk
   */
  private async cacheRule(event: NDKEvent): Promise<void> {
    const titleTag = event.tags.find((tag) => tag[0] === "title");
    const descTag = event.tags.find((tag) => tag[0] === "description");
    const versionTag = event.tags.find((tag) => tag[0] === "ver");

    if (!event.id) {
      throw new Error("Event ID is required for caching rule");
    }

    const rule: CachedRule = {
      eventId: event.id,
      title: titleTag?.[1] || "Untitled Rule",
      description: descTag?.[1] || "",
      content: event.content,
      version: versionTag?.[1],
      fetchedAt: Date.now(),
    };

    this.rulesCache.set(event.id, rule);

    // Save to disk
    const rulePath = path.join(this.rulesDir, `${event.id}.json`);
    await fileSystem.writeJsonFile(rulePath, rule);
  }

  /**
   * Load a cached rule from disk
   */
  private async loadCachedRule(ruleId: string): Promise<CachedRule | null> {
    const rulePath = path.join(this.rulesDir, `${ruleId}.json`);

    try {
      return await fileSystem.readJsonFile<CachedRule>(rulePath);
    } catch (_err) {
      // Rule not cached
      return null;
    }
  }

  /**
   * Get rules for a specific agent
   */
  getRulesForAgent(agentName: string, ruleMappings: RuleMapping[]): CachedRule[] {
    const applicableRules: CachedRule[] = [];

    for (const mapping of ruleMappings) {
      // Rule applies to all agents if no specific agents are listed
      const appliesToAgent =
        mapping.agentNames.length === 0 || mapping.agentNames.includes(agentName);

      if (appliesToAgent && this.rulesCache.has(mapping.ruleEventId)) {
        const rule = this.rulesCache.get(mapping.ruleEventId);
        if (rule) {
          applicableRules.push(rule);
        }
      }
    }

    return applicableRules;
  }

  /**
   * Format rules for system prompt
   */
  formatRulesForPrompt(rules: CachedRule[]): string {
    if (rules.length === 0) {
      return "";
    }

    const sections: string[] = ["## Project Rules\n"];

    for (const rule of rules) {
      sections.push(`### ${rule.title}`);
      if (rule.description) {
        sections.push(`*${rule.description}*`);
      }
      sections.push(rule.content);
      sections.push(""); // Empty line between rules
    }

    return sections.join("\n");
  }
}
