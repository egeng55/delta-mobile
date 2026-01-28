# Delta UI Redesign Specification

**Version:** 2.0
**Last Updated:** 2026-01-28
**Status:** Planning

---

## Executive Summary

Delta's backend intelligence is sophisticated but the frontend only displays ~36% of it. Users see numbers without understanding WHY. This document specifies a complete UI rebuild around Delta's inference capabilities.

**Core Principle:** Delta speaks first. Every metric has a reason. Every screen tells a story.

---

## Part 1: The Problem

### Current State Analysis

| Issue | Impact |
|-------|--------|
| 7 of 11 intelligence endpoints unused | Users miss workout guidance, sleep analysis, trend interpretation |
| ActivityScreen uses hardcoded scoring | "Activity Score" is meaningless - not connected to readiness |
| Loading blocks on slow LLM calls | 15+ second waits, users think app is broken |
| 4-tab navigation fragments data | Users jump between screens to understand their health |
| Metrics without context | "HRV: 42ms" means nothing without Delta explaining it |

### Backend Capabilities Not Shown

```
AVAILABLE BUT HIDDEN:
├── getWorkoutGuidance() → "Reduce intensity 20%, cap HR at 150bpm"
├── analyzeSleep() → "Your deep sleep was 45 min short of optimal"
├── analyzeTrend() → "HRV declining 15% due to accumulated stress"
├── getAlignment() → "Your chronotype suggests 10:30pm bedtime"
├── getNarrative() → "This week: recovery improved, load balanced"
├── explainPattern() → "Late meals delay melatonin release ~2 hours"
└── getCommentary() → "Sleep debt is catching up - prioritize tonight"
```

---

## Part 2: Design Philosophy

### Information Hierarchy (New Priority)

```
1. DELTA'S VOICE        "Your sleep debt is catching up"
        ↓
2. CAUSAL REASONING     Sleep → HRV → Recovery chain visualization
        ↓
3. ACTIONABLE GUIDANCE  "Prioritize 8+ hours tonight"
        ↓
4. SUPPORTING EVIDENCE  [5.8h avg] [42ms HRV] [tap to explore]
```

### Design Principles

1. **Lead with language, not numbers** - Delta speaks in sentences
2. **Every metric is tappable** - Tap any number → Delta explains
3. **Chains show causality** - Animated cause → effect flows
4. **Actions are contextual** - "Log Sleep" appears in sleep insights
5. **Progressive disclosure** - Summary first, details on demand
6. **No orphan data** - If Delta can't explain it, don't show it

---

## Part 3: Navigation Architecture

### New Structure (3 tabs)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                   [Content Area]                    │
│                                                     │
├─────────────────────────────────────────────────────┤
│     [Delta]          [Chat]           [You]         │
│    Intelligent      Ask Delta        Profile &      │
│       Feed                           Settings       │
└─────────────────────────────────────────────────────┘
```

### Tab Breakdown

| Tab | Primary Purpose | Contents |
|-----|-----------------|----------|
| **Delta** | Proactive intelligence | Feed of insights, patterns, guidance |
| **Chat** | Reactive conversation | Full chat with Delta, logging |
| **You** | Self-knowledge | Profile, stats, history, settings |

### Detail Views (Modals/Sheets)

Accessible from feed cards or "You" tab:
- **Workout Detail** - Today's plan with readiness modifications
- **Sleep Detail** - Sleep analysis with architecture breakdown
- **Trends Detail** - Historical charts with trend interpretations
- **Pattern Deep-Dive** - Full causal chain exploration
- **Calendar** - Historical data browser

---

## Part 4: Delta Feed Design

### Feed Architecture

```typescript
interface FeedItem {
  id: string;
  type: 'commentary' | 'insight' | 'pattern' | 'guidance' | 'alert';
  priority: 'high' | 'medium' | 'low';
  tone: 'positive' | 'neutral' | 'caution' | 'rest';
  timestamp: string;

  // Content
  headline: string;           // "Sleep debt building"
  body: string;               // Full explanation
  reasoning?: ReasoningStep[]; // Causal chain

  // Evidence
  metrics?: MetricEvidence[];  // Supporting numbers

  // Actions
  actions?: FeedAction[];      // "Log Sleep", "Ask Delta"

  // Source
  source: 'commentary' | 'pattern' | 'factor' | 'workout' | 'sleep' | 'trend';
}
```

### Card Types

#### 1. Daily Commentary Card (Top of Feed)
```
┌────────────────────────────────────────────────────┐
│  [Delta Avatar]                                    │
│                                                    │
│  "Recovery looks solid today."                     │
│                                                    │
│  Your HRV bounced back to 58ms after two good     │
│  nights of sleep. The stress from last week is    │
│  clearing. This is a good window for intensity.   │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ 🟢 78% Ready  │  58ms HRV  │  7.2h Sleep    │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  [What should I do today?]                         │
└────────────────────────────────────────────────────┘
```

#### 2. Workout Guidance Card
```
┌────────────────────────────────────────────────────┐
│  ⚠️ WORKOUT: CAUTION                              │
│                                                    │
│  "Your readiness is 58. I'd dial back intensity   │
│   by about 20% today."                            │
│                                                    │
│  Modifications:                                    │
│  • Cap heart rate at 150 bpm                      │
│  • Skip the heavy compound sets                   │
│  • Focus on technique over load                   │
│                                                    │
│  Alternative: 30-min Zone 2 cardio                │
│                                                    │
│  [Start Adjusted Workout]    [Skip Today]          │
└────────────────────────────────────────────────────┘
```

#### 3. Pattern Card (Causal Chain)
```
┌────────────────────────────────────────────────────┐
│  📊 PATTERN DETECTED                              │
│                                                    │
│  Late meals → Poor sleep                          │
│  Observed 8 times (75% correlation)               │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │    [Meal >9pm]                             │   │
│  │         │                                  │   │
│  │         ▼                                  │   │
│  │    [Sleep -1.2h]                           │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  "Eating after 9pm delays melatonin release by    │
│   about 2 hours, pushing back your sleep onset."  │
│                                                    │
│  [Learn More]                    [Dismiss]         │
└────────────────────────────────────────────────────┘
```

#### 4. Factor Insight Card
```
┌────────────────────────────────────────────────────┐
│  💤 SLEEP FACTOR                                  │
│                                                    │
│  "Your deep sleep was 45 minutes short."          │
│                                                    │
│  Deep sleep is when growth hormone releases and   │
│  memories consolidate. Getting to bed 30 minutes  │
│  earlier would likely add one more sleep cycle.   │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  Deep: 52min  │  REM: 1.8h  │  Efficiency: 84%│ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  [Set Bedtime Reminder]                            │
└────────────────────────────────────────────────────┘
```

#### 5. Trend Interpretation Card
```
┌────────────────────────────────────────────────────┐
│  📈 HRV TREND                                     │
│                                                    │
│  "Your HRV has improved 18% over 2 weeks."        │
│                                                    │
│  [Mini sparkline chart: upward trend]              │
│                                                    │
│  This suggests your autonomic nervous system is   │
│  adapting well to your current training load.     │
│  The consistency in your sleep schedule is likely │
│  a major contributor.                             │
│                                                    │
│  Outlook: If you maintain this, expect continued  │
│  improvement in recovery capacity.                │
│                                                    │
│  [View Full History]                               │
└────────────────────────────────────────────────────┘
```

### Feed Ordering Algorithm

```typescript
function sortFeedItems(items: FeedItem[]): FeedItem[] {
  return items.sort((a, b) => {
    // 1. Priority (high > medium > low)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    // 2. Actionability (items with actions first)
    if (a.actions?.length && !b.actions?.length) return -1;
    if (!a.actions?.length && b.actions?.length) return 1;

    // 3. Recency (newest first within same priority)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

// Priority assignment:
// HIGH: workout guidance (caution/rest), critical patterns, alerts
// MEDIUM: daily commentary, insights with suggestions
// LOW: informational patterns, historical trends
```

---

## Part 5: Reasoning Chain Visualization

### Chain Component Design

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ┌─────────────┐                        │
│              │ Poor Sleep  │ ← Cause node           │
│              │   < 6 hrs   │                        │
│              └──────┬──────┘                        │
│                     │                               │
│                     │ "3 consecutive nights"        │
│                     ▼                               │
│              ┌─────────────┐                        │
│              │  Low HRV    │ ← Effect node          │
│              │ 42ms (-22%) │                        │
│              └──────┬──────┘                        │
│                     │                               │
│            ┌────────┴────────┐                      │
│            ▼                 ▼                      │
│     ┌──────────┐      ┌──────────┐                  │
│     │ Fatigue  │      │ Reduced  │ ← Downstream     │
│     │ Level 4  │      │ Recovery │                  │
│     └──────────┘      └──────────┘                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Delta recommends: Rest day or light activity  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Animation Specifications

```typescript
// Chain nodes animate in sequence
const nodeAnimation = {
  entering: FadeInDown.delay(index * 150).springify(),
  duration: 400,
};

// Connector lines draw progressively
const connectorAnimation = {
  type: 'draw',
  duration: 300,
  delay: (nodeIndex) => nodeIndex * 150 + 200,
};

// Confidence ring fills as data loads
const confidenceRing = {
  from: 0,
  to: confidence,
  duration: 800,
  easing: 'easeOutCubic',
};
```

### Node Types

| Type | Color | Icon | Example |
|------|-------|------|---------|
| Cause (negative) | Red | ⬇️ | Poor sleep |
| Cause (positive) | Green | ⬆️ | High protein intake |
| Effect (negative) | Orange | ⚠️ | Low HRV |
| Effect (positive) | Teal | ✓ | Good recovery |
| Recommendation | Blue | 💡 | Rest day suggestion |

---

## Part 6: Metric Explanation System

### Tap-to-Explain Pattern

Every displayed metric should be tappable:

```typescript
interface ExplainableMetric {
  value: number | string;
  label: string;
  unit?: string;

  // On tap, show this
  explanation: {
    whatItMeans: string;      // "HRV measures heart rate variability..."
    yourContext: string;      // "Your 42ms is 15% below your baseline..."
    implication: string;      // "This suggests accumulated stress..."
    suggestion?: string;      // "Consider a lighter workout today..."
  };

  // Visual treatment
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'neutral' | 'concern';
}
```

### Explanation Sheet Design

```
┌─────────────────────────────────────────────────────┐
│  ━━━━━  (drag handle)                              │
│                                                     │
│  HRV: Heart Rate Variability                        │
│  ────────────────────────────                       │
│                                                     │
│  42 ms                              ▼ 15% vs avg    │
│  [═══════════░░░░░░░░░░░░░░░░░░░░░░░░░]            │
│  Your range: 35 ──────────────────── 65            │
│                                                     │
│  What this means:                                   │
│  HRV measures the variation between heartbeats.    │
│  Higher variability indicates your parasympathetic │
│  nervous system is dominant — a sign of good       │
│  recovery and low stress.                          │
│                                                     │
│  Your context:                                      │
│  At 42ms, you're below your personal average of    │
│  49ms. This has been trending down for 3 days,     │
│  likely due to the accumulated sleep debt.         │
│                                                     │
│  What to do:                                        │
│  Prioritize 7.5+ hours tonight. Your HRV typically │
│  rebounds within 24-48 hours of adequate sleep.    │
│                                                     │
│  [Ask Delta More]                                   │
└─────────────────────────────────────────────────────┘
```

---

## Part 7: Loading Strategy

### The Problem

Current flow:
```
User opens Insights
    → Fetch 8 endpoints in parallel (including slow LLM calls)
    → Wait 15+ seconds for ALL to complete
    → Show loading spinner entire time
    → User thinks app is broken
```

### New Progressive Loading Strategy

```
User opens Delta Feed
    → Phase 1 (immediate, <500ms):
        Show cached data if available
        Show skeleton placeholders

    → Phase 2 (fast, <2s):
        Fetch: dashboard, weekly, derivatives, healthState
        Render feed with core data

    → Phase 3 (background, 5-15s):
        Fetch: insights, commentary, digestion (LLM endpoints)
        Skeleton cards transform into real content
        No blocking, no spinner
```

### Skeleton Components

```typescript
// Skeleton card while LLM loads
function SkeletonFeedCard({ type }: { type: FeedItem['type'] }) {
  return (
    <Animated.View entering={FadeIn} style={styles.skeletonCard}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonLines}>
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={[styles.skeletonLine, { width: '90%' }]} />
        <View style={[styles.skeletonLine, { width: '75%' }]} />
      </View>
      <ShimmerEffect />
    </Animated.View>
  );
}
```

### State Machine

```typescript
type LoadingState =
  | 'idle'
  | 'loading_core'      // Phase 2 - fast endpoints
  | 'loading_llm'       // Phase 3 - LLM endpoints (background)
  | 'ready'             // All data loaded
  | 'partial'           // Core ready, LLM still loading
  | 'error';

// UI renders at 'partial' state, not 'ready'
```

---

## Part 8: "You" Tab Design

### Profile & Self-Knowledge Hub

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Avatar]                                           │
│  Alex Chen                                          │
│  Member since Jan 2026                              │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  DELTA KNOWS                                  │  │
│  │                                               │  │
│  │  • You're a morning person (6am optimal)     │  │
│  │  • Alcohol disrupts your sleep 75% of time   │  │
│  │  • High protein days = better recovery       │  │
│  │  • Your HRV baseline is 49ms                 │  │
│  │                                               │  │
│  │  [View All Patterns]                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  QUICK STATS                                  │  │
│  │                                               │  │
│  │  Streak: 14 days  │  Logged: 847 entries     │  │
│  │  Avg Sleep: 7.2h  │  Avg Recovery: 72%       │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [View History]  [Export Data]  [Settings]          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### History View (Accessed from "You")

```
┌─────────────────────────────────────────────────────┐
│  ← History                                          │
│                                                     │
│  [Calendar Grid - tap any day]                      │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  January 2026                            < >  │  │
│  │  S   M   T   W   T   F   S                    │  │
│  │              1   2   3   4                    │  │
│  │  5   6   7   8   9  10  11                    │  │
│  │ 12  13  14  15  16  17  18                    │  │
│  │ 19  20  21  22  23  24  25                    │  │
│  │ 26 [27] 28                                    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [Trends]  [Nutrition]  [Sleep]  [Activity]         │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  📈 WEEKLY TREND                              │  │
│  │                                               │  │
│  │  [Chart: HRV over 4 weeks]                    │  │
│  │                                               │  │
│  │  "Your HRV improved 12% this month. The      │  │
│  │   main driver was consistent sleep timing."  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Part 9: Interaction Patterns

### Quick Actions

| Context | Action | Behavior |
|---------|--------|----------|
| Sleep insight | "Log Sleep" | Opens chat with "Log my sleep" prefilled |
| Workout guidance | "Start Workout" | Opens workout detail with modifications |
| Pattern card | "Learn More" | Expands reasoning chain inline |
| Any metric | Tap | Shows explanation bottom sheet |
| Commentary | "Ask Delta" | Opens chat with context passed |

### Gestures

| Gesture | Location | Action |
|---------|----------|--------|
| Pull down | Feed | Refresh all data |
| Swipe left | Feed card | Dismiss/archive |
| Long press | Metric | Quick preview explanation |
| Double tap | Chart | Toggle between views |

### Haptics

| Event | Feedback |
|-------|----------|
| Readiness score reveal | Impact (medium) |
| Pattern detected | Notification |
| Workout recommendation change | Impact (light) |
| Data logged successfully | Success |

---

## Part 10: Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Fix loading, create component library

Tasks:
- [ ] Implement progressive loading in `useInsightsData.ts`
- [ ] Create skeleton components
- [ ] Build `DeltaFeedCard` component family
- [ ] Build `ReasoningChain` component
- [ ] Build `MetricExplanation` bottom sheet
- [ ] Create `useDeltaFeed()` hook to transform API data

Files to create:
```
/src/components/Feed/
  ├── DeltaFeedCard.tsx
  ├── CommentaryCard.tsx
  ├── GuidanceCard.tsx
  ├── PatternCard.tsx
  ├── TrendCard.tsx
  ├── SkeletonCard.tsx
  └── index.ts

/src/components/Reasoning/
  ├── ReasoningChain.tsx
  ├── ChainNode.tsx
  ├── ChainConnector.tsx
  └── index.ts

/src/components/Explanation/
  ├── MetricExplanationSheet.tsx
  ├── ExplainableMetric.tsx
  └── index.ts

/src/hooks/
  ├── useDeltaFeed.ts
  └── useMetricExplanation.ts
```

### Phase 2: Integration (Week 3-4)

**Goal:** Wire unused backend endpoints, replace fake data

Tasks:
- [ ] Wire `getWorkoutGuidance()` → GuidanceCard
- [ ] Wire `analyzeSleep()` → Sleep insights
- [ ] Wire `analyzeTrend()` → TrendCard
- [ ] Wire `explainPattern()` → PatternCard deep dive
- [ ] Remove hardcoded `activityScore` from ActivityScreen
- [ ] Replace with `healthState.readiness.score`

### Phase 3: Navigation (Week 5)

**Goal:** Restructure to 3-tab layout

Tasks:
- [ ] Create new `AppNavigator.tsx` with Delta/Chat/You tabs
- [ ] Merge Insights sub-tabs into Delta Feed
- [ ] Move profile + settings to "You" tab
- [ ] Create History as modal from "You"
- [ ] Add workout detail modal

### Phase 4: Polish (Week 6-7)

**Goal:** Animations, accessibility, performance

Tasks:
- [ ] Chain flow animations
- [ ] Skeleton shimmer effects
- [ ] VoiceOver accessibility
- [ ] Reduce motion support
- [ ] Virtualized feed list for performance
- [ ] Error states with Delta's voice

### Phase 5: Testing & Rollout (Week 8)

Tasks:
- [ ] A/B test new vs old UI
- [ ] Gather user feedback
- [ ] Fix issues
- [ ] Full rollout

---

## Part 11: Success Metrics

### Quantitative

| Metric | Current | Target |
|--------|---------|--------|
| Intelligence endpoints used | 4/11 (36%) | 11/11 (100%) |
| Time to first meaningful content | 15+ sec | <2 sec |
| Screens user visits per session | 3.2 | 1.5 (feed consolidation) |
| Tap-to-explanation rate | N/A | >30% of users |

### Qualitative

- Users understand WHY their metrics matter
- Users take action based on Delta's guidance
- Users report feeling "coached" not just "tracked"
- Users can explain their health patterns to others

---

## Part 12: Open Questions

1. **Should classic view remain?** Power users may want quick numbers without explanations.

2. **How prominent should logging CTAs be?** Balance between useful and annoying.

3. **What happens with no data?** Empty state experience for new users.

4. **Notification strategy?** When should Delta push vs. wait for user to open app?

5. **Offline mode?** Can we show cached insights without network?

---

## Appendix A: API Endpoint Reference

```typescript
// Currently used
healthIntelligenceApi.getState(userId)        // Recovery, load, readiness
healthIntelligenceApi.getInsights(userId)     // Commentary, patterns, factors
healthIntelligenceApi.getDigestionInsights(userId) // Meal analysis

// Need to wire
healthIntelligenceApi.getCommentary(userId)           // Lightweight daily
healthIntelligenceApi.getWorkoutGuidance(userId, state) // Go/caution/skip
healthIntelligenceApi.getAlignment(userId)            // Chronotype
healthIntelligenceApi.getNarrative(userId, period)    // Weekly/monthly
healthIntelligenceApi.analyzeSleep(userId, sleepData) // Sleep quality
healthIntelligenceApi.analyzeTrend(userId, metric, data) // Trend meaning
healthIntelligenceApi.explainPattern(userId, patternId)  // Deep dive
```

---

## Appendix B: Color System

```typescript
const feedColors = {
  // Tone-based card accents
  positive: '#22C55E',  // Green - good news
  neutral: '#3B82F6',   // Blue - informational
  caution: '#F59E0B',   // Amber - attention needed
  rest: '#8B5CF6',      // Purple - recovery focus

  // Readiness badges
  greenLight: '#22C55E', // 80+ ready
  normal: '#3B82F6',     // 60-79 ready
  caution: '#F59E0B',    // 40-59 ready
  rest: '#EF4444',       // <40 ready

  // Chain nodes
  causeNegative: '#EF4444',
  causePositive: '#22C55E',
  effectNegative: '#F97316',
  effectPositive: '#14B8A6',
  recommendation: '#3B82F6',
};
```

---

## Appendix C: Typography for Feed

```typescript
const feedTypography = {
  // Card headline (Delta's main statement)
  headline: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.4,
  },

  // Card body (explanation text)
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    letterSpacing: -0.2,
  },

  // Metric value
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  // Metric label
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
};
```
