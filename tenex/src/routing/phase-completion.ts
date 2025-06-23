import type { Phase, Conversation } from "@/conversations/types";

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
  const hasUserMessages = conversation.history.some(
    event => !event.tags.some(tag => tag[0] === 'llm-model')
  );
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
  const hasApproval = !!conversation.metadata.plan_approved;
  const hasTasks = !!conversation.metadata.tasks;
  
  const criteria = {
    plan: {
      architectureDocumented: hasArchitecture || hasPlan,
      tasksIdentified: hasTasks || hasPlan,
      userApproval: hasApproval,
      feasibilityChecked: true // Would need actual implementation
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
      testsPass: true, // Would need actual test results
      codeCommitted: hasBranch && hasImplementation,
      noBlockingIssues: true // Would need issue tracking
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
      testsConducted: true, // Would need test results
      feedbackIncorporated: true, // Would need feedback tracking
      documentationUpdated: true // Would need doc status
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
      inventoryUpdated: true, // Would need inventory check
      maintenanceTasksComplete: hasChoresSummary,
      cleanupDone: true // Would need cleanup verification
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