import { logger } from "@tenex/shared/logger";

const orchestrationLogger = logger.forModule("orchestration");
import { TEAM_ORCHESTRATOR_PROMPT } from "../../prompts";
import { JSONRepairError, parseJSON } from "../../utils/agents/tools/JSONRepair";
import { TeamFormationError } from "../core/errors";
import type {
  AgentConfig,
  ConversationPlan,
  LLMProvider,
  NostrPublisher,
  TeamFormationRequest,
  TeamFormationResult,
} from "../core/types";

export class TeamOrchestrator {
  constructor(
    private llm: LLMProvider,
    private publisher: NostrPublisher
  ) {}

  async formTeam(request: TeamFormationRequest): Promise<TeamFormationResult> {
    // Always show team formation start - this is critical information
    console.log("🤖 TeamOrchestrator: Analyzing request and forming team...");
    console.log(`📝 User Request: "${request.event.content}"`);

    const prompt = this.buildTeamFormationPrompt(request);
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const completion = await this.llm.complete({
          messages: [
            {
              role: "system",
              content: this.getSystemPrompt(),
            },
            {
              role: "user",
              content: prompt + (attempt > 0 ? this.getRetryGuidance(attempt) : ""),
            },
          ],
          context: {
            agentName: "orchestrator",
            rootEventId: "team-formation",
            eventId: request.event.id,
          },
          temperature: 0.7,
        });

        const response = this.parseTeamFormationResponse(completion.content);

        // Validate response
        this.validateTeamFormation(response, request.availableAgents);

        // Always show team formation result - this is critical information
        console.log(
          `✅ Team formation complete: Lead=${response.team.lead}, Members=[${response.team.members.join(", ")}]`
        );
        console.log(`💭 Reasoning: ${response.reasoning}`);
        console.log(
          `📋 Conversation Plan: ${response.conversationPlan.stages.length} stages, complexity ${response.conversationPlan.estimatedComplexity}/10`
        );

        return response;
      } catch (error) {
        orchestrationLogger.error(`Team formation attempt ${attempt + 1} failed:`, error);

        // If it's a JSON parsing error and we have retries left, try to recover
        if (
          error instanceof TeamFormationError &&
          error.details &&
          typeof error.details === "object" &&
          "rawContent" in error.details &&
          attempt < maxRetries - 1
        ) {
          console.log(
            `🔄 Attempting to recover from malformed JSON (attempt ${attempt + 2}/${maxRetries})`
          );
          continue;
        }

        // If we've exhausted retries or it's not a recoverable error, throw
        if (attempt === maxRetries - 1) {
          throw new TeamFormationError(
            `Failed to form team after ${maxRetries} attempts: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new TeamFormationError("Failed to form team: Maximum retries exceeded");
  }

  private getSystemPrompt(): string {
    return TEAM_ORCHESTRATOR_PROMPT();
  }

  private buildTeamFormationPrompt(request: TeamFormationRequest): string {
    const { event, projectEvent, availableAgents } = request;
    const agentDescriptions = Array.from(availableAgents.entries())
      .map(([name, config]) => `- ${name}: ${config.role}`)
      .join("\n");

    return `User Request: "${event.content}"

Project Context:
- Title: ${projectEvent.title}
- Description: ${projectEvent.description || "N/A"}

Available Agents:
${agentDescriptions}

Analyze this request and form the MINIMAL team needed:
1. Can a single agent handle this entire request? If yes, use only that agent.
2. What specific expertise is needed?
3. Is coordination between multiple specialists truly necessary?
4. If multiple agents are needed, what stages should the conversation go through?

Remember: Prefer single-agent teams for straightforward requests. Only use multi-agent teams when the complexity genuinely requires it.

Respond with a team composition and conversation plan in JSON format.`;
  }

  private parseTeamFormationResponse(content: string): TeamFormationResult {
    // Debug logging for raw LLM response
    orchestrationLogger.debug(`Parsing LLM response content: ${content}`);
    orchestrationLogger.debug(`LLM response content length: ${content.length}`);

    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\n?(.*?)\n?```/s) || content.match(/{.*}/s);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const rawResponse = jsonMatch[1] || jsonMatch[0];
      orchestrationLogger.debug(`Raw JSON response to parse: ${rawResponse}`);

      // Use JSONRepair to parse with automatic fixing
      let parsed: TeamFormationResult;
      let wasRepaired = false;
      try {
        // First try normal JSON.parse to detect if repairs are needed
        try {
          parsed = JSON.parse(rawResponse) as TeamFormationResult;
        } catch (parseError) {
          // Normal parse failed, use JSONRepair
          orchestrationLogger.warning(
            "Standard JSON parse failed, attempting repairs:",
            "normal",
            parseError
          );
          parsed = parseJSON(rawResponse, {
            attemptAutoFix: true,
            maxRetries: 3,
          }) as TeamFormationResult;
          wasRepaired = true;
          orchestrationLogger.info("JSON successfully repaired and parsed");
        }
      } catch (repairError) {
        if (repairError instanceof JSONRepairError) {
          orchestrationLogger.error(
            `JSON repair attempts: ${JSON.stringify(repairError.repairAttempts)}`
          );
          orchestrationLogger.debug("Failed to repair JSON content:", "debug", rawResponse);
        }
        throw repairError;
      }

      if (wasRepaired) {
        orchestrationLogger.warning(
          "Team formation response required JSON repairs - the LLM produced malformed JSON"
        );
      }

      // Validate structure
      if (!parsed.team || !parsed.team.lead || !Array.isArray(parsed.team.members)) {
        throw new Error("Invalid team structure");
      }

      if (!parsed.conversationPlan || !Array.isArray(parsed.conversationPlan.stages)) {
        throw new Error("Invalid conversation plan structure");
      }

      return {
        team: {
          lead: parsed.team.lead,
          members: parsed.team.members,
        },
        conversationPlan: {
          stages: parsed.conversationPlan.stages,
          estimatedComplexity: parsed.conversationPlan.estimatedComplexity || 5,
        },
        reasoning: parsed.reasoning || "No reasoning provided",
      };
    } catch (error) {
      throw new TeamFormationError(
        `Failed to parse team formation response: ${error instanceof Error ? error.message : "Unknown error"}`,
        { rawContent: content }
      );
    }
  }

  private validateTeamFormation(
    response: TeamFormationResult,
    availableAgents: Map<string, AgentConfig>
  ): void {
    const availableAgentNames = Array.from(availableAgents.keys());
    orchestrationLogger.debug(
      `Validating team formation - Available agents: ${availableAgentNames.join(", ")}`
    );
    orchestrationLogger.debug(
      `Proposed team lead: ${response.team.lead}, Proposed members: ${response.team.members.join(", ")}`
    );

    // Check that lead exists
    if (!availableAgents.has(response.team.lead)) {
      throw new TeamFormationError(
        `Team lead '${response.team.lead}' not found in available agents: [${availableAgentNames.join(", ")}]. This usually indicates the LLM hallucinated an agent name that doesn't exist.`
      );
    }

    // Check that all members exist
    for (const member of response.team.members) {
      if (!availableAgents.has(member)) {
        throw new TeamFormationError(
          `Team member '${member}' not found in available agents: [${availableAgentNames.join(", ")}]. This usually indicates the LLM hallucinated an agent name that doesn't exist.`
        );
      }
    }

    // Ensure lead is included in members
    if (!response.team.members.includes(response.team.lead)) {
      response.team.members.unshift(response.team.lead);
      logger.info(`Automatically added team lead '${response.team.lead}' to team members`);
    }

    // Validate conversation plan
    if (response.conversationPlan.stages.length === 0) {
      throw new TeamFormationError("Conversation plan must have at least one stage");
    }

    // Validate each stage
    for (const stage of response.conversationPlan.stages) {
      if (!stage.participants || stage.participants.length === 0) {
        throw new TeamFormationError("Each stage must have at least one participant");
      }

      // Check that stage participants are team members
      for (const participant of stage.participants) {
        if (!response.team.members.includes(participant)) {
          throw new TeamFormationError(`Stage participant '${participant}' is not a team member`);
        }
      }
    }
  }

  private getRetryGuidance(attemptNumber: number): string {
    const guidance = [
      "\n\nIMPORTANT: Your previous response had formatting issues. Please ensure:",
      "1. The JSON is properly formatted with all strings terminated",
      "2. No trailing commas in objects or arrays",
      "3. All brackets and braces are properly closed",
      "4. Use double quotes for all strings (not single quotes)",
      "5. Do not include any text outside the JSON code block",
      "6. Make sure the JSON structure matches this format exactly:",
      "```json",
      "{",
      '  "team": {',
      '    "lead": "agent_name",',
      '    "members": ["agent_name1", "agent_name2"]',
      "  },",
      '  "conversationPlan": {',
      '    "stages": [',
      "      {",
      '        "participants": ["agent_name"],',
      '        "purpose": "...",',
      '        "expectedOutcome": "...",',
      '        "transitionCriteria": "...",',
      '        "primarySpeaker": "agent_name"',
      "      }",
      "    ],",
      '    "estimatedComplexity": 1-10',
      "  },",
      '  "reasoning": "..."',
      "}",
      "```",
    ];

    if (attemptNumber > 1) {
      guidance.push("\nThis is your final attempt. Please double-check your JSON formatting!");
    }

    return guidance.join("\n");
  }
}
