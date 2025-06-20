# Evidence-Based Progress Tracking

## Overview

The Evidence-Based Progress Tracking system replaces subjective progress claims with objective, verifiable evidence. Instead of accepting agent declarations like "task is 80% complete" or "feature is working," this system requires concrete proof for every progress claim through automated verification, artifact analysis, and measurable outcomes. By establishing clear evidence requirements for different types of claims and automating the verification process, the system ensures that progress reports reflect reality rather than optimistic estimates, preventing the common problem of tasks being "90% done" for 90% of the time.

## How It Works

### Core Concept

Every progress claim must be accompanied by:
1. **Specific Evidence**: Concrete artifacts proving the claim
2. **Automated Verification**: System-verified proof of claim validity  
3. **Measurable Outcomes**: Quantifiable results matching expectations
4. **Status Determination**: Objective pass/fail based on evidence

### Evidence Categories

```
Code Changes → Compilation Success → Test Results → Coverage Reports → Performance Metrics
     ↓              ↓                    ↓              ↓                 ↓
  Evidence      Evidence            Evidence       Evidence          Evidence
     ↓              ↓                    ↓              ↓                 ↓
                        Aggregated Progress Score
```

### Claim Types and Required Evidence

- **"Feature Implemented"** → Working code + Passing tests + Documentation
- **"Bug Fixed"** → Reproduction test + Fix + Regression test
- **"Performance Improved"** → Before/After benchmarks + Statistical significance
- **"Refactoring Complete"** → Behavioral tests passing + Code metrics
- **"Documentation Updated"** → Diff showing changes + Validation of accuracy

## Technical Implementation

### Architecture

```typescript
interface EvidenceBasedProgressTracking {
  claimProcessor: ClaimProcessor;
  evidenceCollector: EvidenceCollector;
  verificationEngine: VerificationEngine;
  progressCalculator: ProgressCalculator;
  evidenceStore: EvidenceStore;
  reportGenerator: ReportGenerator;
  auditTrail: AuditTrail;
}

interface ProgressClaim {
  id: string;
  agentId: string;
  taskId: string;
  claimType: ClaimType;
  description: string;
  expectedEvidence: EvidenceRequirement[];
  providedEvidence: Evidence[];
  timestamp: Date;
  verificationStatus?: VerificationResult;
}

interface Evidence {
  id: string;
  type: EvidenceType;
  source: string;
  content: any;
  metadata: EvidenceMetadata;
  verifiable: boolean;
  verification?: VerificationRecord;
}

interface VerificationResult {
  claimId: string;
  status: 'verified' | 'rejected' | 'partial';
  score: number; // 0-1
  evidenceResults: EvidenceVerification[];
  missingEvidence: EvidenceRequirement[];
  summary: string;
  timestamp: Date;
}
```

### Claim Processing System

```typescript
class ClaimProcessor {
  private claimDefinitions: Map<ClaimType, ClaimDefinition>;
  private evidenceCollector: EvidenceCollector;
  private verificationEngine: VerificationEngine;
  
  async processClaim(claim: ProgressClaim): Promise<ProcessedClaim> {
    // Get claim definition
    const definition = this.claimDefinitions.get(claim.claimType);
    if (!definition) {
      throw new Error(`Unknown claim type: ${claim.claimType}`);
    }
    
    // Determine required evidence
    const requiredEvidence = await this.determineRequiredEvidence(
      claim,
      definition
    );
    
    // Collect evidence
    const collectedEvidence = await this.evidenceCollector.collect(
      claim,
      requiredEvidence
    );
    
    // Verify evidence
    const verification = await this.verificationEngine.verify(
      claim,
      collectedEvidence,
      requiredEvidence
    );
    
    // Calculate progress impact
    const progressImpact = this.calculateProgressImpact(
      claim,
      verification
    );
    
    return {
      claim,
      requiredEvidence,
      collectedEvidence,
      verification,
      progressImpact,
      status: this.determineClaimStatus(verification)
    };
  }
  
  private async determineRequiredEvidence(
    claim: ProgressClaim,
    definition: ClaimDefinition
  ): Promise<EvidenceRequirement[]> {
    const requirements: EvidenceRequirement[] = [];
    
    // Base requirements from definition
    requirements.push(...definition.baseRequirements);
    
    // Context-specific requirements
    const context = await this.getClaimContext(claim);
    
    if (context.isCritical) {
      requirements.push(...definition.criticalRequirements);
    }
    
    if (context.hasPerformanceImplications) {
      requirements.push({
        type: 'performance_benchmark',
        description: 'Before and after performance metrics',
        validator: 'performance_validator'
      });
    }
    
    if (context.affectsPublicAPI) {
      requirements.push({
        type: 'api_compatibility',
        description: 'API compatibility verification',
        validator: 'api_validator'
      });
    }
    
    // Custom requirements based on claim details
    const customRequirements = await this.generateCustomRequirements(
      claim,
      context
    );
    requirements.push(...customRequirements);
    
    return requirements;
  }
}

// Claim definitions
const CLAIM_DEFINITIONS = new Map<ClaimType, ClaimDefinition>([
  ['feature_implemented', {
    baseRequirements: [
      {
        type: 'code_changes',
        description: 'Code implementing the feature',
        validator: 'code_existence_validator'
      },
      {
        type: 'unit_tests',
        description: 'Unit tests for the feature',
        validator: 'test_existence_validator'
      },
      {
        type: 'test_results',
        description: 'Passing test results',
        validator: 'test_result_validator'
      },
      {
        type: 'documentation',
        description: 'Feature documentation',
        validator: 'documentation_validator'
      }
    ],
    criticalRequirements: [
      {
        type: 'integration_tests',
        description: 'Integration test coverage',
        validator: 'integration_test_validator'
      },
      {
        type: 'security_review',
        description: 'Security assessment',
        validator: 'security_validator'
      }
    ]
  }],
  
  ['bug_fixed', {
    baseRequirements: [
      {
        type: 'reproduction_test',
        description: 'Test that reproduces the bug',
        validator: 'reproduction_validator'
      },
      {
        type: 'fix_code',
        description: 'Code changes fixing the bug',
        validator: 'fix_validator'
      },
      {
        type: 'regression_test',
        description: 'Test preventing regression',
        validator: 'regression_validator'
      },
      {
        type: 'verification_results',
        description: 'Proof bug no longer occurs',
        validator: 'verification_validator'
      }
    ],
    criticalRequirements: [
      {
        type: 'root_cause_analysis',
        description: 'Documentation of root cause',
        validator: 'analysis_validator'
      }
    ]
  }]
]);
```

### Evidence Collection

```typescript
class EvidenceCollector {
  private collectors: Map<EvidenceType, EvidenceCollectorStrategy>;
  
  async collect(
    claim: ProgressClaim,
    requirements: EvidenceRequirement[]
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    
    // First try to use provided evidence
    for (const provided of claim.providedEvidence) {
      const validated = await this.validateProvidedEvidence(provided);
      if (validated) {
        evidence.push(validated);
      }
    }
    
    // Collect missing evidence
    for (const requirement of requirements) {
      const existing = evidence.find(e => 
        this.matchesRequirement(e, requirement)
      );
      
      if (!existing) {
        const collected = await this.collectEvidence(requirement, claim);
        if (collected) {
          evidence.push(collected);
        }
      }
    }
    
    return evidence;
  }
  
  private async collectEvidence(
    requirement: EvidenceRequirement,
    claim: ProgressClaim
  ): Promise<Evidence | null> {
    const collector = this.collectors.get(requirement.type);
    if (!collector) {
      console.warn(`No collector for evidence type: ${requirement.type}`);
      return null;
    }
    
    try {
      const collected = await collector.collect(claim, requirement);
      
      return {
        id: generateId(),
        type: requirement.type,
        source: collector.name,
        content: collected.data,
        metadata: {
          collectedAt: new Date(),
          collector: collector.name,
          automatic: true,
          requirement: requirement.id
        },
        verifiable: true
      };
    } catch (error) {
      console.error(`Failed to collect evidence: ${error.message}`);
      return null;
    }
  }
}

// Evidence collectors
class TestResultCollector implements EvidenceCollectorStrategy {
  async collect(
    claim: ProgressClaim,
    requirement: EvidenceRequirement
  ): Promise<CollectionResult> {
    // Identify relevant tests
    const tests = await this.identifyRelevantTests(claim);
    
    // Run tests
    const results = await this.runTests(tests);
    
    // Parse results
    const parsed = this.parseTestResults(results);
    
    return {
      data: {
        testCount: parsed.total,
        passed: parsed.passed,
        failed: parsed.failed,
        skipped: parsed.skipped,
        coverage: parsed.coverage,
        details: parsed.details,
        output: results.output
      },
      metadata: {
        testRunner: results.runner,
        duration: results.duration,
        timestamp: results.timestamp
      }
    };
  }
  
  private async identifyRelevantTests(claim: ProgressClaim): Promise<Test[]> {
    // Find tests related to the claim
    const patterns = this.generateTestPatterns(claim);
    const testFiles = await this.findTestFiles(patterns);
    
    return this.parseTestFiles(testFiles);
  }
}

class CodeChangeCollector implements EvidenceCollectorStrategy {
  async collect(
    claim: ProgressClaim,
    requirement: EvidenceRequirement
  ): Promise<CollectionResult> {
    // Get git diff
    const diff = await this.getGitDiff(claim);
    
    // Analyze changes
    const analysis = await this.analyzeChanges(diff);
    
    // Collect metrics
    const metrics = this.calculateMetrics(analysis);
    
    return {
      data: {
        filesChanged: analysis.files.length,
        insertions: analysis.insertions,
        deletions: analysis.deletions,
        files: analysis.files,
        metrics,
        diff: diff
      },
      metadata: {
        branch: await this.getCurrentBranch(),
        commit: await this.getLatestCommit(),
        timestamp: new Date()
      }
    };
  }
}
```

### Verification Engine

```typescript
class VerificationEngine {
  private validators: Map<string, Validator>;
  
  async verify(
    claim: ProgressClaim,
    evidence: Evidence[],
    requirements: EvidenceRequirement[]
  ): Promise<VerificationResult> {
    const results: EvidenceVerification[] = [];
    const missingEvidence: EvidenceRequirement[] = [];
    
    // Verify each requirement
    for (const requirement of requirements) {
      const matchingEvidence = evidence.filter(e => 
        this.matchesRequirement(e, requirement)
      );
      
      if (matchingEvidence.length === 0) {
        missingEvidence.push(requirement);
        continue;
      }
      
      // Validate evidence
      for (const evidenceItem of matchingEvidence) {
        const validation = await this.validateEvidence(
          evidenceItem,
          requirement
        );
        results.push(validation);
      }
    }
    
    // Calculate overall verification score
    const score = this.calculateVerificationScore(
      results,
      requirements,
      missingEvidence
    );
    
    // Determine status
    const status = this.determineStatus(score, results, missingEvidence);
    
    return {
      claimId: claim.id,
      status,
      score,
      evidenceResults: results,
      missingEvidence,
      summary: this.generateSummary(status, results, missingEvidence),
      timestamp: new Date()
    };
  }
  
  private async validateEvidence(
    evidence: Evidence,
    requirement: EvidenceRequirement
  ): Promise<EvidenceVerification> {
    const validator = this.validators.get(requirement.validator);
    if (!validator) {
      return {
        evidenceId: evidence.id,
        requirementId: requirement.id,
        valid: false,
        reason: `No validator found: ${requirement.validator}`,
        score: 0
      };
    }
    
    try {
      const result = await validator.validate(evidence, requirement);
      
      return {
        evidenceId: evidence.id,
        requirementId: requirement.id,
        valid: result.valid,
        score: result.score,
        reason: result.reason,
        details: result.details
      };
    } catch (error) {
      return {
        evidenceId: evidence.id,
        requirementId: requirement.id,
        valid: false,
        reason: `Validation error: ${error.message}`,
        score: 0
      };
    }
  }
  
  private calculateVerificationScore(
    results: EvidenceVerification[],
    requirements: EvidenceRequirement[],
    missing: EvidenceRequirement[]
  ): number {
    // Base score from verified evidence
    const verifiedScore = results
      .filter(r => r.valid)
      .reduce((sum, r) => sum + r.score, 0);
    
    // Penalty for missing required evidence
    const missingPenalty = missing
      .filter(r => r.required)
      .length * 0.2;
    
    // Normalize
    const maxScore = requirements.length;
    const rawScore = (verifiedScore / maxScore) - missingPenalty;
    
    return Math.max(0, Math.min(1, rawScore));
  }
}

// Validators
class TestResultValidator implements Validator {
  async validate(
    evidence: Evidence,
    requirement: EvidenceRequirement
  ): Promise<ValidationResult> {
    const testResults = evidence.content;
    
    // Check if tests actually ran
    if (!testResults.testCount || testResults.testCount === 0) {
      return {
        valid: false,
        score: 0,
        reason: 'No tests were run'
      };
    }
    
    // Check pass rate
    const passRate = testResults.passed / testResults.testCount;
    
    if (passRate < 1.0) {
      return {
        valid: false,
        score: passRate * 0.5,
        reason: `${testResults.failed} tests failed`,
        details: {
          failed: testResults.details.filter(t => t.status === 'failed')
        }
      };
    }
    
    // Check coverage if available
    if (testResults.coverage) {
      const coverage = testResults.coverage.percentage;
      
      if (coverage < 80) {
        return {
          valid: true,
          score: 0.8,
          reason: `Test coverage is ${coverage}% (recommended: 80%+)`,
          details: testResults.coverage
        };
      }
    }
    
    return {
      valid: true,
      score: 1.0,
      reason: 'All tests passing',
      details: {
        testCount: testResults.testCount,
        duration: testResults.duration
      }
    };
  }
}

class CodeExistenceValidator implements Validator {
  async validate(
    evidence: Evidence,
    requirement: EvidenceRequirement
  ): Promise<ValidationResult> {
    const changes = evidence.content;
    
    // Verify files exist
    const filesExist = await this.verifyFilesExist(changes.files);
    
    if (!filesExist.all) {
      return {
        valid: false,
        score: filesExist.percentage,
        reason: 'Some files do not exist',
        details: filesExist.missing
      };
    }
    
    // Verify changes are substantial
    if (changes.insertions < 10 && changes.deletions < 10) {
      return {
        valid: false,
        score: 0.3,
        reason: 'Changes are too minimal to constitute implementation'
      };
    }
    
    // Check for actual implementation (not just comments)
    const codeRatio = await this.calculateCodeRatio(changes.diff);
    
    if (codeRatio < 0.5) {
      return {
        valid: false,
        score: 0.5,
        reason: 'Changes are mostly comments or whitespace'
      };
    }
    
    return {
      valid: true,
      score: 1.0,
      reason: 'Code changes verified',
      details: {
        files: changes.files.length,
        insertions: changes.insertions,
        deletions: changes.deletions
      }
    };
  }
}
```

### Progress Calculator

```typescript
class ProgressCalculator {
  private taskBreakdown: Map<string, TaskBreakdown>;
  private claimWeights: Map<ClaimType, number>;
  
  async calculateProgress(
    taskId: string,
    verifiedClaims: VerifiedClaim[]
  ): Promise<ProgressReport> {
    // Get task breakdown
    const breakdown = this.taskBreakdown.get(taskId);
    if (!breakdown) {
      throw new Error(`No breakdown found for task ${taskId}`);
    }
    
    // Calculate progress for each component
    const componentProgress = new Map<string, ComponentProgress>();
    
    for (const component of breakdown.components) {
      const relevantClaims = verifiedClaims.filter(c => 
        this.claimAffectsComponent(c, component)
      );
      
      const progress = this.calculateComponentProgress(
        component,
        relevantClaims
      );
      
      componentProgress.set(component.id, progress);
    }
    
    // Calculate overall progress
    const overallProgress = this.calculateOverallProgress(
      breakdown,
      componentProgress
    );
    
    // Generate detailed report
    return {
      taskId,
      timestamp: new Date(),
      overallProgress,
      componentProgress: Array.from(componentProgress.entries()),
      verifiedClaims: verifiedClaims.length,
      evidence: this.summarizeEvidence(verifiedClaims),
      milestones: this.checkMilestones(breakdown, componentProgress),
      blockers: this.identifyBlockers(breakdown, componentProgress),
      projections: this.projectCompletion(overallProgress, verifiedClaims)
    };
  }
  
  private calculateComponentProgress(
    component: TaskComponent,
    claims: VerifiedClaim[]
  ): ComponentProgress {
    // Map claims to requirements
    const requirementProgress = new Map<string, number>();
    
    for (const requirement of component.requirements) {
      const relevantClaims = claims.filter(c => 
        this.claimSatisfiesRequirement(c, requirement)
      );
      
      if (relevantClaims.length === 0) {
        requirementProgress.set(requirement.id, 0);
      } else {
        // Use highest verification score
        const maxScore = Math.max(...relevantClaims.map(c => 
          c.verification.score
        ));
        requirementProgress.set(requirement.id, maxScore);
      }
    }
    
    // Calculate weighted progress
    let totalWeight = 0;
    let weightedProgress = 0;
    
    for (const requirement of component.requirements) {
      const progress = requirementProgress.get(requirement.id) || 0;
      const weight = requirement.weight || 1;
      
      weightedProgress += progress * weight;
      totalWeight += weight;
    }
    
    const overallProgress = totalWeight > 0 ? 
      weightedProgress / totalWeight : 0;
    
    return {
      componentId: component.id,
      componentName: component.name,
      progress: overallProgress,
      requirementProgress: Array.from(requirementProgress.entries()),
      completedRequirements: Array.from(requirementProgress.entries())
        .filter(([_, progress]) => progress >= 1.0)
        .map(([id, _]) => id),
      evidence: this.collectComponentEvidence(component, claims)
    };
  }
}
```

### Evidence Store

```typescript
class EvidenceStore {
  private storage: EvidenceStorage;
  private index: EvidenceIndex;
  
  async storeEvidence(evidence: Evidence): Promise<string> {
    // Store evidence content
    const storageKey = await this.storage.store(evidence.content);
    
    // Create evidence record
    const record: EvidenceRecord = {
      id: evidence.id,
      type: evidence.type,
      storageKey,
      metadata: evidence.metadata,
      hash: await this.hashEvidence(evidence),
      timestamp: new Date(),
      verification: evidence.verification
    };
    
    // Index for searching
    await this.index.index(record);
    
    return record.id;
  }
  
  async retrieveEvidence(evidenceId: string): Promise<Evidence> {
    // Get record from index
    const record = await this.index.get(evidenceId);
    if (!record) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    
    // Retrieve content from storage
    const content = await this.storage.retrieve(record.storageKey);
    
    // Verify integrity
    const currentHash = await this.hashContent(content);
    if (currentHash !== record.hash) {
      throw new Error('Evidence integrity check failed');
    }
    
    return {
      id: record.id,
      type: record.type,
      source: record.metadata.source,
      content,
      metadata: record.metadata,
      verifiable: true,
      verification: record.verification
    };
  }
  
  async queryEvidence(query: EvidenceQuery): Promise<Evidence[]> {
    // Search index
    const records = await this.index.search(query);
    
    // Retrieve evidence
    const evidence = await Promise.all(
      records.map(record => this.retrieveEvidence(record.id))
    );
    
    return evidence;
  }
  
  async createAuditTrail(
    taskId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditTrail> {
    const query: EvidenceQuery = {
      taskId,
      startDate: startDate || new Date(0),
      endDate: endDate || new Date()
    };
    
    const evidence = await this.queryEvidence(query);
    
    // Build chronological trail
    const trail = evidence
      .sort((a, b) => 
        a.metadata.collectedAt.getTime() - b.metadata.collectedAt.getTime()
      )
      .map(e => ({
        timestamp: e.metadata.collectedAt,
        evidenceId: e.id,
        type: e.type,
        summary: this.summarizeEvidence(e),
        verification: e.verification
      }));
    
    return {
      taskId,
      period: {
        start: query.startDate,
        end: query.endDate
      },
      entries: trail,
      summary: this.summarizeAuditTrail(trail)
    };
  }
}
```

### Report Generator

```typescript
class ProgressReportGenerator {
  async generateReport(
    taskId: string,
    options: ReportOptions = {}
  ): Promise<ProgressReport> {
    // Get all verified claims
    const claims = await this.getVerifiedClaims(taskId);
    
    // Calculate progress
    const progress = await this.progressCalculator.calculateProgress(
      taskId,
      claims
    );
    
    // Generate visualizations
    const visualizations = await this.generateVisualizations(
      progress,
      options
    );
    
    // Create detailed report
    return {
      taskId,
      generatedAt: new Date(),
      summary: this.generateSummary(progress),
      detailedProgress: progress,
      visualizations,
      evidence: await this.compileEvidence(claims, options),
      recommendations: this.generateRecommendations(progress),
      risks: this.identifyRisks(progress)
    };
  }
  
  private generateSummary(progress: ProgressReport): ReportSummary {
    return {
      overallProgress: `${(progress.overallProgress * 100).toFixed(1)}%`,
      completedMilestones: progress.milestones.filter(m => m.completed).length,
      totalMilestones: progress.milestones.length,
      verifiedClaims: progress.verifiedClaims,
      topBlockers: progress.blockers.slice(0, 3),
      estimatedCompletion: progress.projections.estimatedCompletion,
      confidenceLevel: this.calculateConfidence(progress)
    };
  }
  
  private async generateVisualizations(
    progress: ProgressReport,
    options: ReportOptions
  ): Promise<Visualization[]> {
    const visualizations: Visualization[] = [];
    
    // Progress bar chart
    visualizations.push({
      type: 'progress_bar',
      data: {
        overall: progress.overallProgress,
        components: progress.componentProgress.map(([id, comp]) => ({
          name: comp.componentName,
          progress: comp.progress
        }))
      }
    });
    
    // Evidence timeline
    visualizations.push({
      type: 'timeline',
      data: await this.createEvidenceTimeline(progress)
    });
    
    // Verification scores
    visualizations.push({
      type: 'scatter',
      data: this.createVerificationScatter(progress)
    });
    
    // Burndown chart
    if (options.includeBurndown) {
      visualizations.push({
        type: 'burndown',
        data: await this.createBurndownChart(progress)
      });
    }
    
    return visualizations;
  }
  
  private generateRecommendations(
    progress: ProgressReport
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Identify lagging components
    const laggingComponents = progress.componentProgress
      .filter(([_, comp]) => comp.progress < 0.5)
      .sort((a, b) => a[1].progress - b[1].progress);
    
    if (laggingComponents.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'focus_area',
        title: 'Focus on lagging components',
        description: `Components ${laggingComponents.map(c => c[1].componentName).join(', ')} are behind schedule`,
        actions: laggingComponents.map(([_, comp]) => 
          `Complete requirements for ${comp.componentName}`
        )
      });
    }
    
    // Missing evidence patterns
    const missingEvidenceTypes = this.analyzeMissingEvidence(progress);
    
    if (missingEvidenceTypes.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'evidence_gap',
        title: 'Address evidence gaps',
        description: `Frequently missing evidence types: ${missingEvidenceTypes.join(', ')}`,
        actions: [
          'Ensure test coverage for all features',
          'Document implementation decisions',
          'Run performance benchmarks'
        ]
      });
    }
    
    // Velocity-based recommendations
    const velocityAnalysis = this.analyzeVelocity(progress);
    
    if (velocityAnalysis.declining) {
      recommendations.push({
        priority: 'medium',
        type: 'velocity',
        title: 'Progress velocity declining',
        description: 'Rate of verified progress has decreased',
        actions: [
          'Review and address blockers',
          'Consider breaking down large tasks',
          'Ensure clear requirements'
        ]
      });
    }
    
    return recommendations;
  }
}
```

### Automated Evidence Collection

```typescript
class AutomatedEvidenceCollector {
  private collectors: Map<string, AutomatedCollector>;
  private scheduler: CollectionScheduler;
  
  async setupContinuousCollection(
    taskId: string,
    requirements: EvidenceRequirement[]
  ): Promise<void> {
    // Determine collection schedule
    const schedule = this.scheduler.createSchedule(requirements);
    
    // Set up collectors
    for (const requirement of requirements) {
      const collector = this.collectors.get(requirement.type);
      
      if (collector && collector.supportsContinuous) {
        await collector.setupContinuous(taskId, requirement, schedule);
      }
    }
    
    // Start collection
    await this.scheduler.start(taskId);
  }
}

class ContinuousTestCollector implements AutomatedCollector {
  supportsContinuous = true;
  
  async setupContinuous(
    taskId: string,
    requirement: EvidenceRequirement,
    schedule: CollectionSchedule
  ): Promise<void> {
    // Watch for file changes
    const watcher = await this.setupFileWatcher(taskId);
    
    watcher.on('change', async (files) => {
      // Determine affected tests
      const tests = await this.findAffectedTests(files);
      
      if (tests.length > 0) {
        // Run tests
        const results = await this.runTests(tests);
        
        // Create evidence
        const evidence: Evidence = {
          id: generateId(),
          type: 'test_results',
          source: 'continuous_test_runner',
          content: results,
          metadata: {
            trigger: 'file_change',
            files: files,
            automatic: true,
            collectedAt: new Date()
          },
          verifiable: true
        };
        
        // Store evidence
        await this.storeEvidence(taskId, evidence);
      }
    });
  }
  
  private async findAffectedTests(changedFiles: string[]): Promise<Test[]> {
    // Use dependency graph to find affected tests
    const graph = await this.loadDependencyGraph();
    const affectedModules = new Set<string>();
    
    for (const file of changedFiles) {
      const dependents = graph.getDependents(file);
      dependents.forEach(d => affectedModules.add(d));
    }
    
    // Find tests for affected modules
    const tests: Test[] = [];
    
    for (const module of affectedModules) {
      const moduleTests = await this.findTestsForModule(module);
      tests.push(...moduleTests);
    }
    
    return tests;
  }
}
```

### Claim Verification Examples

```typescript
class ClaimExamples {
  // Example: Feature Implementation Claim
  async verifyFeatureImplementation(
    claim: ProgressClaim
  ): Promise<VerificationResult> {
    const evidence: Evidence[] = [];
    
    // 1. Verify code exists
    const codeEvidence = await this.collectCodeEvidence(claim);
    evidence.push(codeEvidence);
    
    // 2. Verify tests exist and pass
    const testEvidence = await this.collectTestEvidence(claim);
    evidence.push(testEvidence);
    
    // 3. Verify documentation
    const docEvidence = await this.collectDocumentationEvidence(claim);
    evidence.push(docEvidence);
    
    // 4. Verify integration
    const integrationEvidence = await this.collectIntegrationEvidence(claim);
    evidence.push(integrationEvidence);
    
    // Verify all evidence
    const verification = await this.verificationEngine.verify(
      claim,
      evidence,
      FEATURE_REQUIREMENTS
    );
    
    return verification;
  }
  
  // Example: Performance Improvement Claim
  async verifyPerformanceImprovement(
    claim: ProgressClaim
  ): Promise<VerificationResult> {
    const evidence: Evidence[] = [];
    
    // 1. Collect baseline metrics
    const baselineEvidence: Evidence = {
      id: generateId(),
      type: 'performance_baseline',
      source: 'benchmark_runner',
      content: await this.runBenchmark('before'),
      metadata: {
        version: 'before_changes',
        collectedAt: new Date()
      },
      verifiable: true
    };
    evidence.push(baselineEvidence);
    
    // 2. Collect current metrics
    const currentEvidence: Evidence = {
      id: generateId(),
      type: 'performance_current',
      source: 'benchmark_runner',
      content: await this.runBenchmark('after'),
      metadata: {
        version: 'after_changes',
        collectedAt: new Date()
      },
      verifiable: true
    };
    evidence.push(currentEvidence);
    
    // 3. Statistical analysis
    const analysisEvidence: Evidence = {
      id: generateId(),
      type: 'statistical_analysis',
      source: 'statistics_engine',
      content: await this.analyzePerformance(
        baselineEvidence.content,
        currentEvidence.content
      ),
      metadata: {
        method: 't-test',
        confidence: 0.95,
        collectedAt: new Date()
      },
      verifiable: true
    };
    evidence.push(analysisEvidence);
    
    // Verify improvement
    return this.verificationEngine.verify(
      claim,
      evidence,
      PERFORMANCE_REQUIREMENTS
    );
  }
}
```

### Nostr Event Integration

```typescript
// Evidence-based progress event kinds
const EVIDENCE_EVENTS = {
  PROGRESS_CLAIM: 5000,
  EVIDENCE_SUBMITTED: 5001,
  VERIFICATION_RESULT: 5002,
  PROGRESS_UPDATE: 5003,
  EVIDENCE_REQUEST: 5004,
  MILESTONE_ACHIEVED: 5005
};

// Progress claim event
interface ProgressClaimEvent extends NDKEvent {
  kind: 5000;
  tags: [
    ['d', claimId],
    ['task', taskId],
    ['claim-type', claimType],
    ['a', agentNaddr],
    ['evidence-count', evidenceCount.toString()],
    ['auto-verify', autoVerifiable.toString()]
  ];
  content: JSON.stringify({
    description: claimDescription,
    expectedEvidence: requiredEvidence,
    providedEvidence: evidenceReferences,
    metadata: claimMetadata
  });
}

// Verification result event
interface VerificationResultEvent extends NDKEvent {
  kind: 5002;
  tags: [
    ['e', progressClaimEventId],
    ['verified', isVerified.toString()],
    ['score', verificationScore.toFixed(3)],
    ['evidence-valid', validEvidenceCount.toString()],
    ['evidence-missing', missingEvidenceCount.toString()]
  ];
  content: JSON.stringify({
    verification: detailedResults,
    missingEvidence: missingRequirements,
    summary: verificationSummary
  });
}

// Progress update event
interface ProgressUpdateEvent extends NDKEvent {
  kind: 5003;
  tags: [
    ['d', progressUpdateId],
    ['task', taskId],
    ['progress', overallProgress.toFixed(3)],
    ['verified-claims', verifiedClaimCount.toString()],
    ['evidence-items', totalEvidenceCount.toString()],
    ['milestone-progress', `${completedMilestones}/${totalMilestones}`]
  ];
  content: JSON.stringify({
    componentProgress: detailedComponentProgress,
    milestones: milestoneStatus,
    evidence: evidenceSummary,
    projections: completionProjections
  });
}
```

## Pros

1. **Objective Truth**: Progress based on verifiable evidence, not claims
2. **Fraud Prevention**: Impossible to claim false progress
3. **Clear Requirements**: Agents know exactly what evidence is needed
4. **Automated Verification**: Most evidence can be verified automatically
5. **Audit Trail**: Complete record of all claims and evidence
6. **Early Warning**: Missing evidence indicates problems early
7. **Quality Focus**: Evidence requirements enforce quality practices
8. **Detailed Insights**: Rich data about actual vs claimed progress

## Cons

1. **Collection Overhead**: Gathering evidence takes time and resources
2. **Storage Requirements**: Evidence storage can be substantial
3. **Rigid Structure**: Some progress hard to capture as evidence
4. **False Negatives**: Valid progress might lack required evidence
5. **Complexity**: System requires sophisticated verification logic
6. **Learning Curve**: Agents must understand evidence requirements
7. **Maintenance**: Evidence definitions need regular updates

## Implementation Details

### Step 1: Define Evidence Requirements

```typescript
class EvidenceRequirementDefinition {
  defineRequirementsForProject(
    project: Project
  ): Map<ClaimType, EvidenceRequirement[]> {
    const requirements = new Map<ClaimType, EvidenceRequirement[]>();
    
    // Define based on project type
    if (project.type === 'web_application') {
      requirements.set('feature_implemented', [
        {
          type: 'code_changes',
          description: 'Source code implementing the feature',
          required: true,
          validator: 'code_validator',
          minScore: 0.8
        },
        {
          type: 'unit_tests',
          description: 'Unit tests with >80% coverage',
          required: true,
          validator: 'test_validator',
          minScore: 0.8
        },
        {
          type: 'integration_tests',
          description: 'Integration tests for feature',
          required: project.critical,
          validator: 'integration_validator',
          minScore: 0.7
        },
        {
          type: 'ui_screenshots',
          description: 'Screenshots showing feature',
          required: true,
          validator: 'screenshot_validator',
          minScore: 0.9
        },
        {
          type: 'documentation',
          description: 'User-facing documentation',
          required: true,
          validator: 'doc_validator',
          minScore: 0.7
        }
      ]);
    }
    
    // Add performance requirements
    if (project.performanceCritical) {
      const perfRequirements = requirements.get('feature_implemented') || [];
      perfRequirements.push({
        type: 'performance_benchmark',
        description: 'Performance impact assessment',
        required: true,
        validator: 'performance_validator',
        minScore: 0.8
      });
    }
    
    return requirements;
  }
}
```

### Step 2: Evidence Collection Setup

```typescript
class EvidenceCollectionSetup {
  async setupForTask(
    task: Task,
    requirements: EvidenceRequirement[]
  ): Promise<CollectionPlan> {
    const plan: CollectionPlan = {
      automatic: [],
      manual: [],
      continuous: []
    };
    
    for (const req of requirements) {
      const collector = this.selectCollector(req);
      
      if (collector.isAutomatic) {
        plan.automatic.push({
          requirement: req,
          collector,
          schedule: this.determineSchedule(req)
        });
      } else {
        plan.manual.push({
          requirement: req,
          instructions: this.generateInstructions(req)
        });
      }
      
      if (collector.supportsContinuous) {
        plan.continuous.push({
          requirement: req,
          collector,
          trigger: this.determineTrigger(req)
        });
      }
    }
    
    return plan;
  }
  
  private determineSchedule(
    requirement: EvidenceRequirement
  ): CollectionSchedule {
    switch (requirement.type) {
      case 'test_results':
        return {
          trigger: 'on_code_change',
          debounce: 300000, // 5 minutes
          maxFrequency: 3600000 // 1 hour
        };
        
      case 'performance_benchmark':
        return {
          trigger: 'on_demand',
          minInterval: 3600000 // 1 hour
        };
        
      case 'code_coverage':
        return {
          trigger: 'on_test_run',
          aggregate: true
        };
        
      default:
        return {
          trigger: 'on_claim',
          immediate: true
        };
    }
  }
}
```

### Step 3: Verification Pipeline

```typescript
class VerificationPipeline {
  async processClaimBatch(claims: ProgressClaim[]): Promise<BatchResult> {
    const results: ProcessedClaim[] = [];
    
    // Group claims by type for efficient processing
    const groupedClaims = this.groupByType(claims);
    
    for (const [type, typeClaims] of groupedClaims) {
      // Collect evidence in batch
      const evidence = await this.batchCollectEvidence(type, typeClaims);
      
      // Verify in parallel
      const verifications = await Promise.all(
        typeClaims.map(claim => 
          this.verifyWithEvidence(claim, evidence.get(claim.id))
        )
      );
      
      results.push(...verifications);
    }
    
    // Update progress
    await this.updateProgress(results);
    
    // Generate report
    const report = await this.generateBatchReport(results);
    
    return {
      processed: results.length,
      verified: results.filter(r => r.verified).length,
      rejected: results.filter(r => !r.verified).length,
      report
    };
  }
  
  private async batchCollectEvidence(
    type: ClaimType,
    claims: ProgressClaim[]
  ): Promise<Map<string, Evidence[]>> {
    const evidenceMap = new Map<string, Evidence[]>();
    
    // Get shared evidence (e.g., test runs that cover multiple claims)
    const sharedEvidence = await this.collectSharedEvidence(type, claims);
    
    // Distribute to relevant claims
    for (const claim of claims) {
      const relevant = sharedEvidence.filter(e => 
        this.isRelevantToClaim(e, claim)
      );
      
      // Collect claim-specific evidence
      const specific = await this.collectSpecificEvidence(claim);
      
      evidenceMap.set(claim.id, [...relevant, ...specific]);
    }
    
    return evidenceMap;
  }
}
```

### Step 4: Progress Visualization

```typescript
class EvidenceBasedProgressVisualization {
  generateDashboard(
    task: Task,
    progress: ProgressReport
  ): Dashboard {
    return {
      summary: {
        overall: this.createProgressGauge(progress.overallProgress),
        claims: this.createClaimStats(progress),
        evidence: this.createEvidenceStats(progress)
      },
      
      components: this.createComponentBreakdown(progress),
      
      timeline: this.createEvidenceTimeline(progress),
      
      verification: {
        scores: this.createVerificationScoreChart(progress),
        failures: this.createFailureAnalysis(progress)
      },
      
      projections: this.createProjections(progress),
      
      alerts: this.generateAlerts(progress)
    };
  }
  
  private createComponentBreakdown(
    progress: ProgressReport
  ): ComponentVisualization {
    return {
      type: 'nested_progress',
      data: progress.componentProgress.map(([id, comp]) => ({
        id,
        name: comp.componentName,
        progress: comp.progress,
        requirements: comp.requirementProgress.map(([reqId, prog]) => ({
          id: reqId,
          progress: prog,
          evidence: this.summarizeRequirementEvidence(reqId, comp)
        })),
        color: this.getProgressColor(comp.progress)
      }))
    };
  }
  
  private createEvidenceTimeline(
    progress: ProgressReport
  ): TimelineVisualization {
    const events: TimelineEvent[] = [];
    
    // Add claim events
    for (const claim of progress.claims) {
      events.push({
        type: 'claim',
        timestamp: claim.timestamp,
        title: `${claim.claimType}: ${claim.description}`,
        status: claim.verified ? 'verified' : 'rejected'
      });
    }
    
    // Add evidence events
    for (const evidence of progress.evidence) {
      events.push({
        type: 'evidence',
        timestamp: evidence.collectedAt,
        title: `Evidence: ${evidence.type}`,
        linked: evidence.claimId
      });
    }
    
    // Add milestone events
    for (const milestone of progress.milestones) {
      if (milestone.achieved) {
        events.push({
          type: 'milestone',
          timestamp: milestone.achievedAt,
          title: `Milestone: ${milestone.name}`,
          impact: 'major'
        });
      }
    }
    
    return {
      type: 'timeline',
      events: events.sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      ),
      markers: this.generateTimelineMarkers(progress)
    };
  }
}
```

### Step 5: Learning and Optimization

```typescript
class EvidenceLearningSystem {
  async learnFromVerifications(
    completedTask: CompletedTask
  ): Promise<void> {
    // Analyze evidence patterns
    const patterns = await this.analyzeEvidencePatterns(completedTask);
    
    // Update evidence requirements
    await this.optimizeRequirements(patterns);
    
    // Train validators
    await this.updateValidators(completedTask);
    
    // Generate insights
    const insights = await this.generateInsights(patterns);
    
    // Store learnings
    await this.storeLearnings({
      taskType: completedTask.type,
      patterns,
      insights,
      recommendations: this.generateRecommendations(insights)
    });
  }
  
  private async analyzeEvidencePatterns(
    task: CompletedTask
  ): Promise<EvidencePattern[]> {
    const patterns: EvidencePattern[] = [];
    
    // Find missing evidence patterns
    const missingPatterns = this.findMissingEvidencePatterns(task);
    patterns.push(...missingPatterns);
    
    // Find redundant evidence
    const redundantPatterns = this.findRedundantEvidence(task);
    patterns.push(...redundantPatterns);
    
    // Find evidence quality issues
    const qualityPatterns = this.analyzeEvidenceQuality(task);
    patterns.push(...qualityPatterns);
    
    // Find verification failures
    const failurePatterns = this.analyzeVerificationFailures(task);
    patterns.push(...failurePatterns);
    
    return patterns;
  }
  
  private async optimizeRequirements(
    patterns: EvidencePattern[]
  ): Promise<void> {
    // Identify consistently missing evidence
    const alwaysMissing = patterns
      .filter(p => p.type === 'missing' && p.frequency > 0.8);
    
    for (const pattern of alwaysMissing) {
      // Consider making optional or removing
      await this.proposeRequirementChange({
        requirement: pattern.requirement,
        change: 'make_optional',
        reason: 'Frequently missing in practice'
      });
    }
    
    // Identify redundant evidence
    const redundant = patterns
      .filter(p => p.type === 'redundant' && p.confidence > 0.9);
    
    for (const pattern of redundant) {
      // Consider removing
      await this.proposeRequirementChange({
        requirement: pattern.requirement,
        change: 'remove',
        reason: 'Redundant with other evidence'
      });
    }
  }
}
```

## Sales Pitch

Evidence-Based Progress Tracking transforms progress reporting from a game of telephone into a court of law where claims require proof. By demanding concrete, verifiable evidence for every progress claim, this system eliminates the guesswork, optimism bias, and outright deception that plague traditional progress tracking.

**Why Evidence-Based Progress Tracking is essential for reliable AI systems:**

1. **Unassailable Truth**: When progress is based on verified evidence rather than claims, stakeholders can trust the numbers completely.

2. **Quality Enforcement**: Evidence requirements naturally enforce best practices—you can't claim a feature is done without tests, documentation, and verification.

3. **Early Problem Detection**: Missing evidence immediately highlights issues, rather than discovering problems at the 11th hour.

4. **Learning and Improvement**: Rich evidence data enables analysis of what actually contributes to progress, optimizing future work.

5. **Audit Compliance**: Complete evidence trail satisfies the most stringent audit requirements, essential for regulated industries.

6. **Agent Accountability**: Agents quickly learn that only verifiable work counts, driving behavior toward quality outcomes.

This system excels in:
- Mission-critical projects where accuracy matters
- Distributed teams needing objective progress metrics
- Regulated environments requiring proof of compliance
- Long-running projects where progress drift is common
- High-stakes deliverables where surprises are unacceptable

## Summary

Evidence-Based Progress Tracking revolutionizes how we measure and report progress by replacing subjective claims with objective evidence. Through systematic evidence collection, automated verification, and rigorous scoring, the system ensures that reported progress reflects ground truth rather than hopeful estimates.

The multi-layered approach—from defining evidence requirements to collecting, verifying, and analyzing evidence—creates a robust framework that's both flexible and rigorous. Automated collection reduces the burden on agents while maintaining evidence quality, while the verification engine ensures that only legitimate progress is counted.

While the system requires initial setup and ongoing maintenance of evidence definitions and validators, the benefits in terms of accuracy, trust, and insight far outweigh the costs. The ability to definitively know the true state of progress, backed by verifiable evidence, transforms project management from an art into a science.

For organizations that need to know—not guess—where their projects stand, Evidence-Based Progress Tracking provides the framework for achieving this clarity. It's not just about tracking progress; it's about proving it.