# Delta UI/UX Brainstorm

**Date:** 2026-01-28
**Purpose:** Radical ideas for making Delta's intelligence shine

---

## The Core Question

> How do we make an AI health advisor feel like having a smart friend who knows your body?

Current apps (Whoop, Oura, MyFitnessPal) are **data dashboards**. Delta should be a **conversation partner** that happens to have data.

---

## Concept 1: "Delta Speaks First"

### Current Pattern (Bad)
```
[Screen loads]
→ Show numbers in cards
→ User has to interpret
→ Maybe sees an "insight" buried somewhere
```

### New Pattern (Good)
```
[Screen loads]
→ Delta speaks: "Good morning. Here's what I'm seeing..."
→ Numbers appear as EVIDENCE for what Delta said
→ User understands before seeing any data
```

### Implementation

**Morning greeting based on state:**
```
[Readiness 80+]
"You're primed for a strong day. Sleep paid off."

[Readiness 50-79]
"Decent baseline, but I'd pace yourself today."

[Readiness <50]
"Your body's asking for recovery. Let's respect that."
```

**Every screen opens with Delta's take:**
- Activity: "Your training load is building well. One more rest day this week would optimize gains."
- Sleep: "Two things jumped out from last night..."
- Nutrition: "Protein timing looks off. Here's what I'd adjust..."

---

## Concept 2: "The Delta Card"

### One unified UI primitive

Instead of different card types, ONE card format that adapts:

```
┌────────────────────────────────────────────────────┐
│  [Icon] [Category]                    [Importance] │
│                                                    │
│  "Headline in Delta's voice"                       │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ [Supporting visual / chain / chart / metric] │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  Body text: explanation, context, mechanisms       │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ Evidence: [metric] [metric] [metric]         │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [Primary Action]              [Secondary Action]  │
└────────────────────────────────────────────────────┘
```

**Importance levels:**
- 🔴 Critical - Requires attention now
- 🟡 Notable - Worth knowing
- 🔵 Informational - Good to know
- 🟢 Positive - Celebration/reinforcement

**Categories:**
- 💬 Commentary (Delta's daily take)
- 🏋️ Workout (guidance, modifications)
- 😴 Recovery (sleep, HRV, factors)
- 📊 Pattern (causal chains)
- 📈 Trend (metric interpretations)
- ⚠️ Alert (data issues, warnings)

---

## Concept 3: "Contextual Quick Actions"

### Every insight has a natural next step

| Insight | Quick Action |
|---------|--------------|
| "Sleep debt building" | [Set bedtime reminder] |
| "Protein intake low today" | [Log a meal] |
| "Good day for intensity" | [Start workout] |
| "HRV declining" | [Ask Delta why] |
| "Pattern: alcohol → poor sleep" | [Set drink limit reminder] |

**Implementation:**
```typescript
interface QuickAction {
  label: string;
  icon: string;

  // Action types
  action:
    | { type: 'navigate'; screen: string; params?: object }
    | { type: 'chat'; prefill: string }
    | { type: 'log'; category: 'meal' | 'workout' | 'sleep' }
    | { type: 'reminder'; title: string; time?: string }
    | { type: 'external'; url: string };
}
```

---

## Concept 4: "The Knowledge Graph"

### Visual representation of what Delta knows about you

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              YOUR HEALTH GRAPH                     │
│                                                    │
│         [Sleep] ─────────── [HRV]                  │
│            │                  │                    │
│            │    "Strong       │                    │
│            │    correlation"  │                    │
│            ▼                  ▼                    │
│       [Recovery] ◄──────► [Energy]                 │
│            │                  │                    │
│            └───────┬──────────┘                    │
│                    │                               │
│                    ▼                               │
│             [Performance]                          │
│                                                    │
│  Tap any node to explore                           │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Each node is tappable:**
- Shows current state
- Shows trend
- Shows what affects it
- Shows what it affects

**Edges show correlations:**
- Thickness = strength
- Color = positive (green) / negative (red)
- Animation = direction of influence

---

## Concept 5: "Time Machine"

### Scrub through your health history with Delta narrating

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  [◄ Dec 15 ════════════●════════════ Jan 28 ►]    │
│                    Jan 10                          │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │                                              │  │
│  │  "This was a turning point. You started     │  │
│  │   sleeping 7.5+ hours consistently.         │  │
│  │   Watch how your HRV responds..."           │  │
│  │                                              │  │
│  │  [Animated chart showing HRV improving]     │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  Key moments:                                      │
│  • Jan 3: Started sleep routine                   │
│  • Jan 10: HRV baseline improved 15%              │
│  • Jan 18: First "green light" workout day        │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Delta narrates key transitions:**
- "Here's when your training started paying off"
- "This week you were sick - notice the HRV drop"
- "Stress from work travel showed up here"

---

## Concept 6: "Morning Brief"

### One screen to start your day

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  MONDAY, JANUARY 28                                │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  [Delta Avatar]                              │  │
│  │                                              │  │
│  │  "Morning! You're at 72% readiness.          │  │
│  │   Sleep was solid, HRV is climbing.          │  │
│  │   Good day for your planned leg workout,     │  │
│  │   but I'd skip the heavy squats - your       │  │
│  │   quads are still recovering from Friday."   │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  TODAY'S PLAN                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ ✓ 7.5h sleep achieved                        │  │
│  │ ○ Leg day (modified) - 4pm                   │  │
│  │ ○ 150g protein target                        │  │
│  │ ○ 2500 cal target (+200 workout day)         │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ONE THING TO FOCUS ON                             │
│  ┌──────────────────────────────────────────────┐  │
│  │ 💧 "Hydrate before 2pm. You tend to          │  │
│  │    forget water in the afternoon."           │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [Start My Day]                                    │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Concept 7: "Ask Anything" Interface

### Natural language for everything

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  Ask Delta anything...                             │
│  ──────────────────────────────────────────────    │
│                                                    │
│  SUGGESTED QUESTIONS                               │
│                                                    │
│  [Why is my HRV low?]                              │
│  [Should I work out today?]                        │
│  [What's affecting my sleep?]                      │
│  [Show me last week's trends]                      │
│  [When should I eat next?]                         │
│                                                    │
│  RECENT QUESTIONS                                  │
│                                                    │
│  "Why do I feel tired after lunch?"                │
│  → "Your post-lunch energy dips likely relate      │
│     to the high-carb, low-protein meals..."        │
│                                                    │
│  "Is my training load too high?"                   │
│  → "Your current load (78) is moderate for your    │
│     recovery capacity. You could push to 90..."    │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Delta can answer:**
- Causal questions ("Why...")
- Predictive questions ("Will I...")
- Comparative questions ("How does X compare to...")
- Action questions ("Should I...")
- Historical questions ("When did...")

---

## Concept 8: "Proactive Notifications"

### Delta reaches out at the right moments

| Trigger | Notification | Timing |
|---------|--------------|--------|
| Readiness drops below 50 | "Your body needs recovery today" | 7am |
| 5+ hours since last meal | "Consider eating something" | Dynamic |
| Approaching bedtime target | "Wind down for 10:30pm bedtime?" | 9:45pm |
| Post-workout | "Log your workout while it's fresh" | 30 min after |
| Pattern emerging | "I'm noticing a pattern..." | Next app open |
| Weekly milestone | "You've logged 7 days straight!" | End of day |

**Notification design:**
```
┌─────────────────────────────────────────┐
│ Delta                              now  │
│                                         │
│ "Your HRV bounced back to 58ms. Good    │
│  sign - yesterday's rest day paid off." │
│                                         │
│ [See Details]         [Log Workout]     │
└─────────────────────────────────────────┘
```

---

## Concept 9: "Delta Learns Aloud"

### Show users WHEN Delta learns something new

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  🧠 DELTA LEARNED SOMETHING                        │
│                                                    │
│  "I noticed something over the past 2 weeks:       │
│                                                    │
│   When you have alcohol after 8pm, your deep       │
│   sleep drops by ~35 minutes on average.           │
│                                                    │
│   This has happened 6 times with 83% consistency.  │
│   I'll factor this into future recommendations."   │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  [Chart: Alcohol timing vs deep sleep]       │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [That's accurate]    [Actually, not quite...]    │
│                                                    │
└────────────────────────────────────────────────────┘
```

**User feedback loop:**
- Confirm = reinforce the learning
- Deny = Delta asks for more context
- This builds trust and accuracy

---

## Concept 10: "Comparison Mode"

### See yourself vs. your optimal self

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  YOU vs YOUR BEST                                  │
│                                                    │
│  When you feel best, you typically have:           │
│                                                    │
│  Sleep          ████████░░  7.2h vs 7.8h ideal    │
│  HRV            ██████░░░░  52ms vs 58ms ideal    │
│  Protein        █████████░  145g vs 150g ideal    │
│  Stress         ████░░░░░░  2.3 vs 1.8 ideal      │
│                                                    │
│  Gap analysis:                                     │
│  "Sleep and stress are your biggest levers.        │
│   An extra 30 min of sleep would likely bring      │
│   your HRV up 8-10%, based on your history."       │
│                                                    │
│  [What should I prioritize?]                       │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Concept 11: "Experiment Mode"

### Delta helps you run n=1 experiments

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  🧪 ACTIVE EXPERIMENT                              │
│                                                    │
│  "Earlier bedtime → Better HRV"                    │
│  Day 5 of 14                                       │
│                                                    │
│  Hypothesis: Going to bed 30 min earlier will      │
│  improve your HRV by 10% within 2 weeks.           │
│                                                    │
│  Progress:                                         │
│  ┌──────────────────────────────────────────────┐  │
│  │  Bedtime compliance: 4/5 days (80%)          │  │
│  │  HRV change so far: +6% (on track)           │  │
│  │  Days remaining: 9                           │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  Tonight's goal: In bed by 10:30pm                 │
│                                                    │
│  [Log Bedtime]                    [End Experiment] │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Experiment types:**
- Sleep timing
- Protein intake
- Caffeine cutoff
- Training volume
- Alcohol reduction
- Supplement trials

---

## Concept 12: "Voice of Delta"

### Consistent personality across all interactions

**Delta's personality traits:**
- **Knowledgeable** - Uses scientific terms but explains them
- **Direct** - Says what it means without hedging
- **Encouraging** - Celebrates wins, frames setbacks constructively
- **Curious** - Asks questions, notices patterns
- **Honest** - Admits uncertainty, doesn't overpromise

**Example voice patterns:**

| Situation | Bad | Good |
|-----------|-----|------|
| Low readiness | "Readiness is low" | "Your body's asking for recovery today" |
| Good sleep | "Sleep was good" | "That's more like it - 7.8 hours with solid deep sleep" |
| Missed target | "You didn't hit protein goal" | "Protein came up a bit short. Tomorrow's a new day" |
| Pattern found | "A pattern was detected" | "I'm noticing something - alcohol seems to affect your sleep" |
| Uncertainty | "Results unclear" | "I don't have enough data yet to say for sure" |

---

## Concept 13: "Quick Log Widgets"

### Log without opening full app

**iOS Widget (Medium):**
```
┌──────────────────────────────────────┐
│  Delta                    72% Ready  │
│                                      │
│  "Good recovery day. Light workout   │
│   would be ideal."                   │
│                                      │
│  [🍽 Meal] [💧 Water] [😴 Sleep]    │
└──────────────────────────────────────┘
```

**Apple Watch Complication:**
```
┌─────────────┐
│     72%     │
│    Ready    │
│   [Log]     │
└─────────────┘
```

---

## Concept 14: "Social Proof Without Social"

### Learn from aggregate patterns without sharing data

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  📊 PEOPLE LIKE YOU                                │
│                                                    │
│  Among users with similar profiles:                │
│  • Age: 30-35                                      │
│  • Goal: Muscle gain                               │
│  • Activity: 4-5 workouts/week                     │
│                                                    │
│  Typical patterns:                                 │
│  • Average 2.1g protein/kg body weight            │
│  • Rest 2 days between leg sessions               │
│  • HRV improves 12% over first 3 months           │
│                                                    │
│  You're in the top 20% for sleep consistency.     │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Priority Matrix

| Concept | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Delta Speaks First | High | Low | 🔴 Do First |
| The Delta Card | High | Medium | 🔴 Do First |
| Morning Brief | High | Medium | 🔴 Do First |
| Quick Actions | High | Low | 🔴 Do First |
| Ask Anything | High | Low | 🟡 Do Second |
| Proactive Notifications | Medium | Medium | 🟡 Do Second |
| Delta Learns Aloud | Medium | Medium | 🟡 Do Second |
| Knowledge Graph | High | High | 🟡 Do Second |
| Time Machine | Medium | High | 🔵 Later |
| Comparison Mode | Medium | Medium | 🔵 Later |
| Experiment Mode | Medium | High | 🔵 Later |
| Quick Log Widgets | Low | Medium | 🔵 Later |
| Social Proof | Low | High | ⚪ Maybe Never |

---

## Next Steps

1. **Prototype Morning Brief** - Single most impactful change
2. **Implement Delta Card** - Unify all content
3. **Wire unused endpoints** - Workout guidance, sleep analysis, trends
4. **Add Quick Actions** - Every insight → action
5. **Build Knowledge Graph** - Visual differentiation from competitors

---

## Questions to Answer

1. Should Delta have a visible avatar/face or remain abstract?
2. How much personality is too much? (Siri-level vs. friend-level)
3. What's the right frequency for proactive notifications?
4. Should we show uncertainty? ("I'm 70% confident...")
5. How do we handle when Delta is wrong?
