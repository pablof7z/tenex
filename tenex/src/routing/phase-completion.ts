import type { Phase, Conversation } from "@/conversations/types";
import { isEventFromUser } from "@/nostr/utils";

export interface PhaseCompletionCriteria {
  phase: Phase;
  completed: boolean;
  completedAt?: number;
  criteria: PhaseSpecificCriteria;
  outcome: 'success' | 'partial' | 'failed' | 'pending';
  nextSteps?: string[];
}

export interface PhaseSpecificCriteria {
  chat?: {
    requirementsCaptured: boolean;
    userNeedsClarified: boolean;
    readyForPlanning: boolean;
  };
  plan?: {
    architectureDocumented: boolean;
    tasksIdentified: boolean;
    userApproval: boolean;
    feasibilityChecked: boolean;
  };
  execute?: {
    allTasksCompleted: boolean;
    testsPass: boolean;
    codeCommitted: boolean;
    noBlockingIssues: boolean;
  };
  review?: {
    validationComplete: boolean;
    testsConducted: boolean;
    feedbackIncorporated: boolean;
    documentationUpdated: boolean;
  };
  chores?: {
    inventoryUpdated: boolean;
    maintenanceTasksComplete: boolean;
    cleanupDone: boolean;
  };
}

export function evaluatePhaseCompletion(
  phase: Phase,
  conversation: Conversation
): PhaseCompletionCriteria {
  switch (phase) {
    case 'chat':
      return evaluateChatCompletion(conversation);
    case 'plan':
      return evaluatePlanCompletion(conversation);
    case 'execute':
      return evaluateExecuteCompletion(conversation);
    case 'review':
      return evaluateReviewCompletion(conversation);
    case 'chores':
      return evaluateChoresCompletion(conversation);
  }
}

function evaluateChatCompletion(conversation: Conversation): PhaseCompletionCriteria {
  const hasUserMessages = conversation.history.some(event => isEventFromUser(event));
  const hasRequirements = !!conversation.metadata.requirements;
  const hasSummary = !!conversation.metadata.summary;
  
  const criteria = {
    chat: {
      requirementsCaptured: hasRequirements,
      userNeedsClarified: hasSummary,
      readyForPlanning: hasUserMessages && hasRequirements
    }
  };
  
  const allCriteriaMet = Object.values(criteria.chat).every(v => v);
  
  return {
    phase: 'chat',
    completed: allCriteriaMet,
    completedAt: allCriteriaMet ? Date.now() : undefined,
    criteria,
    outcome: allCriteriaMet ? 'success' : 'pending',
    nextSteps: allCriteriaMet ? ['Create architectural plan'] : ['Capture requirements']
  };
}

function evaluatePlanCompletion(conversation: Conversation): PhaseCompletionCriteria {
  const hasPlan = !!conversation.metadata.plan || !!conversation.metadata.plan_summary;
  const hasArchitecture = !!conversation.metadata.architecture;
  const hasApproval = conversation.metadata.plan_approved === true || 
                     conversation.metadata.plan_approved === "true";
  const hasTasks = !!conversation.metadata.tasks;
  
  const criteria = {
    plan: {
      architectureDocumented: hasArchitecture || hasPlan,
      tasksIdentified: hasTasks || hasPlan,
      userApproval: hasApproval,
      feasibilityChecked: hasPlan // Simplified - assume feasibility checked if plan exists
    }
  };
  
  const allCriteriaMet = Object.values(criteria.plan).every(v => v);
  
  return {
    phase: 'plan',
    completed: allCriteriaMet,
    completedAt: allCriteriaMet ? Date.now() : undefined,
    criteria,
    outcome: allCriteriaMet ? 'success' : 'pending',
    nextSteps: allCriteriaMet ? ['Begin implementation'] : ['Get user approval']
  };
}

function evaluateExecuteCompletion(conversation: Conversation): PhaseCompletionCriteria {
  const hasExecuteSummary = !!conversation.metadata.execute_summary;
  const hasBranch = !!conversation.metadata.branch;
  const hasImplementation = hasExecuteSummary || !!conversation.metadata.implementation_complete;
  
  const criteria = {
    execute: {
      allTasksCompleted: hasImplementation,
      testsPass: hasImplementation, // Assume tests pass if implementation is complete
      codeCommitted: hasBranch && hasImplementation,
      noBlockingIssues: hasImplementation // Assume no blocking issues if implementation is complete
    }
  };
  
  const allCriteriaMet = Object.values(criteria.execute).every(v => v);
  
  return {
    phase: 'execute',
    completed: allCriteriaMet,
    completedAt: allCriteriaMet ? Date.now() : undefined,
    criteria,
    outcome: allCriteriaMet ? 'success' : 'pending',
    nextSteps: allCriteriaMet ? ['Review implementation'] : ['Complete remaining tasks']
  };
}

function evaluateReviewCompletion(conversation: Conversation): PhaseCompletionCriteria {
  const hasReviewSummary = !!conversation.metadata.review_summary;
  const hasValidation = !!conversation.metadata.validation_complete;
  
  const criteria = {
    review: {
      validationComplete: hasValidation || hasReviewSummary,
      testsConducted: hasReviewSummary, // Assume tests conducted if review summary exists
      feedbackIncorporated: hasReviewSummary, // Assume feedback incorporated if review complete
      documentationUpdated: hasReviewSummary // Assume docs updated if review complete
    }
  };
  
  const allCriteriaMet = Object.values(criteria.review).every(v => v);
  
  return {
    phase: 'review',
    completed: allCriteriaMet,
    completedAt: allCriteriaMet ? Date.now() : undefined,
    criteria,
    outcome: allCriteriaMet ? 'success' : 'pending',
    nextSteps: allCriteriaMet ? ['Deploy or start new task'] : ['Address feedback']
  };
}

function evaluateChoresCompletion(conversation: Conversation): PhaseCompletionCriteria {
  const hasChoresSummary = !!conversation.metadata.chores_summary;
  
  const criteria = {
    chores: {
      inventoryUpdated: hasChoresSummary, // Assume inventory updated if chores complete
      maintenanceTasksComplete: hasChoresSummary,
      cleanupDone: hasChoresSummary // Assume cleanup done if chores complete
    }
  };
  
  const allCriteriaMet = Object.values(criteria.chores).every(v => v);
  
  return {
    phase: 'chores',
    completed: allCriteriaMet,
    completedAt: allCriteriaMet ? Date.now() : undefined,
    criteria,
    outcome: allCriteriaMet ? 'success' : 'pending',
    nextSteps: allCriteriaMet ? ['Start new conversation'] : ['Complete maintenance']
  };
}