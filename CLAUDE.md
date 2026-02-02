# Delta Mobile - Project Context

> **Last Updated:** 2026-02-02 — Security audit remediation round 2 complete. See delta-backend `PROJECT_NOTES.md` for full changelog.
>
> **Round 1 changes:** hardcoded secrets moved to `app.config.ts` + env vars, `expo-secure-store` for auth tokens, `babel-plugin-transform-remove-console` + `module-resolver` added, `recordDecision()` no-ops in prod, AuthScreen validation tightened (email regex, 8-char password min, 100-char name limit), Android build changed to app-bundle, `_archived/` added to `.gitignore`.
>
> **Round 2 changes:** body-based endpoint ownership verification added, XSS protection in support emails, URL-quoted user IDs in all Supabase queries, GDPR-compliant user data deletion (14+ tables), debug endpoints blocked in production, workout plan ownership verification, auth token added to healthSync, intelligence cache cleared on logout, serverIsWarm staleness reset, offline sync replay implemented.

## Architecture Overview

Delta is a React Native (Expo) health intelligence app. **Delta is not a dashboard — it's an AI scientist studying the user.** The chat IS the app, patterns are the product, transparency is the differentiator.

**Delta is also a data analyst.** It doesn't just discover patterns — it chooses the right visualization framework to present findings, reasons about what to show, and lets users zoom in/out across time frames. Think: a research scientist who also makes beautiful charts to explain their findings.

### Navigation: 3 Tabs

```
Delta (chat) | Journal (log) | You (profile + intelligence)
```

- **Delta tab** (`ChatScreen.tsx`) — Default landing, conversational AI with proactive cards, inline visualizations, voice input. Delta chooses which charts to render inline based on what it's discussing.
- **Journal tab** (`JournalScreen.tsx`) — Daily health log with timeline and calendar scrubber. Users log by talking to Delta, not through arbitrary numeric scales. **QuickLog (1-5 scales) has been removed** — users tell Delta naturally ("I'm feeling down today") instead of picking numbers.
- **You tab** (`YouScreen.tsx`) — Patterns, Delta's Brain (predictions/beliefs/gaps), Profile+Stats. Visual analytics framework for pattern visualization.

### Key Files

| Area | Files |
|------|-------|
| Navigation | `src/navigation/AppNavigator.tsx` (3-tab: Delta/Journal/You) |
| Chat | `src/screens/ChatScreen.tsx` (proactive cards, voice, image, conversations) |
| Journal | `src/screens/JournalScreen.tsx` (timeline, date scrubber — NO QuickLog) |
| You | `src/screens/YouScreen.tsx` (patterns, brain, profile merged) |
| API | `src/services/api.ts` (~2000 lines, all endpoints) |
| Theme | `src/theme/colors.ts`, `src/theme/designSystem.ts` |
| Data hook | `src/hooks/useInsightsData.ts` (cached analytics/workout/calendar) |
| Auth | `src/context/AuthContext.tsx` |
| Supabase | `src/services/supabase.ts` |
| Simulation | `scripts/simulate.ts` (8 persona archetypes, 90-day data gen) |

### Components

| Component | Purpose |
|-----------|---------|
| `ProactiveCard.tsx` | Agent-surfaced insights above chat input |
| `InlineChart.tsx` | Mini sparkline charts in chat messages |
| `Timeline.tsx` | Vertical chronological view of daily entries |
| `PatternCard.tsx` | Expandable causal chain display (cause→effect, confidence, belief history) |
| `DeltaBrain.tsx` | Prediction accuracy, active predictions, belief updates, knowledge gaps |
| `Feed/ReasoningChain.tsx` | Delta's step-by-step reasoning visualization |
| `CausalChain/ChainCard.tsx` | Cause-effect pattern display |
| `Profile/StatCard.tsx` | Custom user stat cards |
| `Chat/VoiceChatModal.tsx` | Voice input for chat |

### Components Removed

| Component | Reason |
|-----------|--------|
| `QuickLog.tsx` | Removed — arbitrary 1-5 scales are bad UX. Users talk to Delta naturally instead. |
| `RecoveryGauge` / `StrainGauge` | Removed — no gauges in conversation-first design |
| `CircularProgress` for scores | Removed — no score numbers as hero elements |

### Screens Cut (Replaced by 3-tab design)

- `TodayScreen` → Chat proactive cards + Journal snapshot
- `RecoveryScreen` → Chat + You patterns
- `ActivityScreen` → Journal + Chat
- `InsightsScreen` → You screen
- `DeltaFeedScreen` → Chat proactive cards
- `InsightsNavigator` → Removed (was 4th tab wrapper)

### API Endpoints (Health Intelligence)

**Working (backend implemented):**
```
GET  /health-intelligence/{user_id}/state             → Health state (recovery, load, energy, alignment)
GET  /health-intelligence/{user_id}/causal-chains      → Detected causal patterns
GET  /health-intelligence/{user_id}/baselines          → Personal baselines
GET  /health-intelligence/{user_id}/narrative/{period}  → Weekly/monthly narrative
GET  /health-intelligence/{user_id}/insights           → LLM-powered insights
GET  /health-intelligence/{user_id}/commentary         → Daily commentary
GET  /health-intelligence/{user_id}/digestion          → Digestion insights
POST /health-intelligence/{user_id}/workout-guidance   → Workout recommendations
POST /health-intelligence/{user_id}/sleep-analysis     → Sleep analysis
POST /health-intelligence/{user_id}/trend-analysis     → Trend analysis
PUT  /calendar/{user_id}/{date}                        → Log daily data
GET  /calendar/{user_id}/{date}                        → Get daily log
GET  /calendar/{user_id}/month/{year}/{month}          → Get month logs
POST /chat                                              → Chat with Delta
POST /chat/with-inference                               → Chat with health context
GET  /health-intelligence/{user_id}/agent-actions      → Proactive cards
GET  /health-intelligence/{user_id}/learned-chains     → Discovered patterns (detailed)
GET  /health-intelligence/{user_id}/predictions        → Active predictions
GET  /health-intelligence/{user_id}/belief-updates     → What Delta learned
GET  /health-intelligence/{user_id}/uncertainty         → Knowledge gaps
GET  /health-intelligence/{user_id}/learning-status    → Overall AI progress
```

### Simulation Infrastructure

**Script:** `scripts/simulate.ts`
- 8 persona archetypes: College Athlete, Busy Mom, Sedentary Worker, Weekend Warrior, Endurance Runner, Stressed Exec, Healthy Retiree, Night Shift Nurse
- Plus "Eric" profile matching user's real lifestyle
- Each generates 90 days of realistic, varied health data with intentional cause-effect patterns
- Data pushes via `PUT /calendar/{userId}/{date}` (all working)
- Intelligence analysis requires user to exist in Supabase profiles table
- Simulated user IDs: `sim-eric-profile`, `sim-college-athlete`, `sim-busy-mom`, etc.

**Key finding:** Simulated users don't get intelligence results because they lack Supabase profile entries. Need either: (a) local intelligence analysis, or (b) create test profiles in Supabase.

### Color Palette (Dark Theme)

```
Background:     #0A0A0F  (near-black with blue tint)
Surface:        #14141F  (dark blue-gray)
Delta's voice:  #6366F1  (indigo) at 15% for card backgrounds
Border:         #1E1E2E
Success:        #5EEAD4  (muted teal, not bright green)
Warning:        #FBBF24  (soft amber)
Accent:         #6366F1  (indigo)
```

### Design Philosophy

- **Delta is an AI scientist AND data analyst** — it discovers patterns AND chooses the best way to visualize them
- Conversational cards over dashboards
- Confidence indicators on every AI insight
- Timeline over static grids
- Frosted glass for AI-generated content
- Monochrome + indigo accent
- No circular gauges, no traffic light colors, no score numbers as hero elements
- **No arbitrary numeric scales** — users express themselves naturally, Delta interprets
- **Visual analytics framework** — Delta reasons about which chart type best represents a finding, supports zooming across time frames

### Backend

- URL: `https://delta-80ht.onrender.com`
- Python (FastAPI) on Render
- Supabase for auth/profiles/storage
- Cold start timeout: 45s (Render)
- Chat timeout: 30s
- All intelligence endpoints are now working

### Tech Stack

- React Native + Expo
- TypeScript (strict)
- react-native-reanimated for animations
- @react-navigation (stack + bottom tabs)
- AsyncStorage for local caching
- Supabase for auth/profiles

### Pending Work

1. **Remove QuickLog** from JournalScreen — users talk to Delta, not pick numbers
2. ~~Build 6 missing backend endpoints~~ — Done, field mappings fixed
3. **Visual analytics framework** — Delta as data analyst, choosing chart types, zoom levels
4. **Local simulation DB** — run intelligence analysis locally for testing
5. **Aesthetic improvements** — Journal and overall app polish
