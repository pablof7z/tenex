import type { ConversationPlan, Team as ITeam } from "../core/types";

export class Team implements ITeam {
  constructor(
    public id: string,
    public rootEventId: string,
    public lead: string,
    public members: string[],
    public plan: ConversationPlan,
    public createdAt: number = Date.now()
  ) {}

  static create(
    rootEventId: string,
    lead: string,
    members: string[],
    plan: ConversationPlan
  ): Team {
    const id = `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return new Team(id, rootEventId, lead, members, plan);
  }

  hasAgent(agentName: string): boolean {
    return this.lead === agentName || this.members.includes(agentName);
  }

  getCurrentStageParticipants(stageIndex: number): string[] {
    if (stageIndex >= 0 && stageIndex < this.plan.stages.length) {
      const stage = this.plan.stages[stageIndex];
      return stage ? stage.participants : [];
    }
    return [];
  }

  isComplete(currentStage: number): boolean {
    return currentStage >= this.plan.stages.length;
  }
}
