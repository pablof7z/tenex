# Comprehensive Lesson System Logging

## Overview

I've implemented comprehensive logging throughout the learn tool and lesson retrieval system to enable monitoring, debugging, and performance analysis.

## Logging Implementation

### 1. Learn Tool Execution (`/src/tools/implementations/learn.ts`)
```typescript
// When recording a new lesson
logger.info("🎓 Agent recording new lesson", {
    agent: context.agentName,
    agentPubkey: context.agent.pubkey,
    title,
    lessonLength: lesson.length,
    keywordCount: keywords?.length || 0,
    keywords: keywords?.join(", ") || "none",
    phase: context.phase,
    conversationId: context.conversationId,
});

// On successful publish
logger.info("✅ Successfully published agent lesson", {
    agent: context.agentName,
    agentPubkey: context.agent.pubkey,
    eventId: lessonEvent.id,
    title,
    keywords: keywords?.length || 0,
    phase: context.phase,
    projectId: projectCtx.project.tagId(),
    totalLessonsForAgent: projectCtx.getLessonsForAgent(context.agent.pubkey).length,
    totalLessonsInProject: projectCtx.getAllLessons().length,
});
```

### 2. Lesson Retrieval (`/src/prompts/fragments/retrieved-lessons.ts`)
```typescript
// Context logging
logger.debug("📚 Lesson retrieval context", {
    agent: agent.name,
    phase,
    conversationId: conversation.id,
    totalLessons: allLessons.length,
    myLessonsCount: myLessons.length,
    otherLessonsCount: otherLessons.length,
});

// Detailed injection logging
logger.info("📖 Injecting lessons into agent prompt", {
    agent: agent.name,
    agentPubkey: agent.pubkey,
    phase,
    conversationId: conversation.id,
    lessonsShown: lessonsToShow.length,
    lessonTitles: lessonsToShow.map(l => ({
        title: l.title || 'Untitled',
        fromAgent: l.pubkey === agent.pubkey ? 'self' : 'other',
        phase: l.tags.find(tag => tag[0] === 'phase')?.[1],
        keywords: l.tags.filter(tag => tag[0] === 't').map(tag => tag[1]).join(', ') || 'none',
        eventId: l.id,
    })),
});
```

### 3. Subscription Handling (`/src/commands/run/SubscriptionManager.ts`)
```typescript
// Subscription setup
logger.debug("📚 Agent lessons subscription filter:", {
    kinds: lessonFilter.kinds,
    authorCount: agentPubkeys.length,
    authors: agentPubkeys,
    projectId: project.tagId(),
    projectName: project.tagValue("title") || "Untitled",
});

// Real-time lesson receipt
logger.info("📚 Received and stored agent lesson", {
    agent: agentName,
    agentPubkey: lesson.pubkey,
    title: lesson.title,
    eventId: lesson.id,
    phase: lesson.tags.find(tag => tag[0] === "phase")?.[1],
    keywords: lesson.tags.filter(tag => tag[0] === "t").map(tag => tag[1]).join(", ") || "none",
    createdAt: new Date((lesson.created_at || 0) * 1000).toISOString(),
    totalLessonsForAgent: projectCtx.getLessonsForAgent(lesson.pubkey).length,
    totalLessonsInProject: projectCtx.getAllLessons().length,
});

// Initial load completion
logger.info(chalk.green(`✓ Agent lessons subscription active - loaded ${totalLessons} historical lessons`));
```

### 4. Metrics Helper (`/src/utils/lessonMetrics.ts`)

#### Comprehensive Metrics
```typescript
logger.info("📊 Lesson System Metrics", {
    totalLessons: metrics.totalLessons,
    averageLessonLength: metrics.averageLessonLength,
    lessonsByAgent: Object.fromEntries(metrics.lessonsByAgent),
    lessonsByPhase: Object.fromEntries(metrics.lessonsByPhase),
    topKeywords: metrics.mostCommonKeywords.slice(0, 5).map(k => `${k.keyword}(${k.count})`).join(", "),
    dateRange: {
        oldest: metrics.oldestLesson.toISOString(),
        newest: metrics.newestLesson.toISOString(),
        spanDays: Math.round((metrics.newestLesson.getTime() - metrics.oldestLesson.getTime()) / (1000 * 60 * 60 * 24))
    },
});
```

## Log Levels and Purposes

### INFO Level (🎓 📚 📖 ✅ ❌ 📊)
- **Purpose**: Key events and metrics for monitoring
- **Examples**:
  - Lesson creation and publication
  - Lesson injection into prompts
  - Subscription status
  - Periodic metrics reports

### DEBUG Level
- **Purpose**: Detailed context for troubleshooting
- **Examples**:
  - Subscription filters
  - Retrieval context
  - Lesson distribution

### ERROR Level
- **Purpose**: Failures requiring attention
- **Examples**:
  - Failed lesson publication
  - Subscription errors
  - Metrics reporting failures

## Metrics Tracked

### 1. **Creation Metrics**
- Total lessons created
- Lessons per agent
- Lessons per phase
- Keywords used
- Average lesson length
- Creation timestamps

### 2. **Retrieval Metrics**
- Lessons shown per prompt
- Source distribution (self vs others)
- Keywords in retrieved lessons
- Phase matching

### 3. **System Metrics**
- Total lessons in memory
- Memory limit adherence (50/agent)
- Subscription health
- Load performance

## Usage Patterns Analysis

The logging enables analysis of:
1. **Learning Velocity** - How often agents create lessons
2. **Knowledge Transfer** - Cross-agent lesson usage
3. **Topic Distribution** - Most common keywords/phases
4. **Retrieval Effectiveness** - Which lessons are surfaced most
5. **System Performance** - Load times, memory usage

## Monitoring Recommendations

### Real-time Monitoring
- Watch INFO logs for lesson creation/usage patterns
- Monitor ERROR logs for system issues
- Track subscription health via "subscription active" messages

### Periodic Analysis
- Run metrics reports to analyze trends
- Export logs for deeper analysis
- Correlate lesson usage with task success

### Alerting Suggestions
- Alert on lesson creation failures
- Alert on subscription disconnections
- Alert on memory limit violations

## Log Examples

### Successful Lesson Creation
```
🎓 Agent recording new lesson {agent: "PM", title: "Git rebase strategy", keywords: "git, rebase", phase: "execute"}
✅ Successfully published agent lesson {eventId: "abc123", totalLessonsForAgent: 12, totalLessonsInProject: 45}
```

### Lesson Retrieval
```
📖 Injecting lessons into agent prompt {agent: "Backend Dev", lessonsShown: 5, lessonTitles: [...]}
```

### Metrics Report
```
📊 Lesson System Metrics {totalLessons: 45, lessonsByAgent: {PM: 20, "Backend Dev": 15, "Frontend Dev": 10}}
```

The comprehensive logging provides full visibility into the lesson system's operation, enabling data-driven improvements and troubleshooting.