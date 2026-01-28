# Delta Mobile - Project Context

## Architecture Overview

Delta is a React Native (Expo) health intelligence app. **Delta is not a dashboard — it's an AI scientist studying the user.** The chat IS the app, patterns are the product, transparency is the differentiator.

### Navigation: 3 Tabs

```
Delta (chat) | Journal (log) | You (profile + intelligence)
```

- **Delta tab** (`ChatScreen.tsx`) — Default landing, conversational AI with proactive cards, inline viz, voice input
- **Journal tab** (`JournalScreen.tsx`) — Daily health log with quick-log cards, timeline, calendar scrubber. No scores.
- **You tab** (`YouScreen.tsx`) — Patterns, Delta's Brain (predictions/beliefs/gaps), Profile+Stats

### Key Files

| Area | Files |
|------|-------|
| Navigation | `src/navigation/AppNavigator.tsx` (3-tab: Delta/Journal/You) |
| Chat | `src/screens/ChatScreen.tsx` (proactive cards, voice, image, conversations) |
| Journal | `src/screens/JournalScreen.tsx` (quick-log, timeline, date scrubber) |
| You | `src/screens/YouScreen.tsx` (patterns, brain, profile merged) |
| API | `src/services/api.ts` (~1900 lines, all endpoints) |
| Theme | `src/theme/colors.ts`, `src/theme/designSystem.ts` |
| Data hook | `src/hooks/useInsightsData.ts` (cached analytics/workout/calendar) |
| Auth | `src/context/AuthContext.tsx` |
| Supabase | `src/services/supabase.ts` |

### New Components (Redesign)

| Component | Purpose |
|-----------|---------|
| `ProactiveCard.tsx` | Agent-surfaced insights above chat input |
| `InlineChart.tsx` | Mini sparkline charts in chat messages |
| `QuickLog.tsx` | 1-tap mood/energy/stress/water logging (1-5 scale) |
| `Timeline.tsx` | Vertical chronological view of daily entries |
| `PatternCard.tsx` | Expandable causal chain display (cause→effect, confidence, belief history) |
| `DeltaBrain.tsx` | Prediction accuracy, active predictions, belief updates, knowledge gaps |

### Existing Components (Kept)

| Component | Purpose |
|-----------|---------|
| `Feed/ReasoningChain.tsx` | Delta's step-by-step reasoning visualization |
| `CausalChain/ChainCard.tsx` | Cause-effect pattern display |
| `Profile/StatCard.tsx` | Custom user stat cards |
| `Chat/VoiceChatModal.tsx` | Voice input for chat |
| `Dashboard/PullDownDashboard.tsx` | Pull-down dashboard in chat |

### Screens Cut (Replaced by 3-tab design)

- `TodayScreen` → Chat proactive cards + Journal snapshot
- `RecoveryScreen` → Chat + You patterns
- `ActivityScreen` → Journal + Chat
- `InsightsScreen` → You screen
- `DeltaFeedScreen` → Chat proactive cards
- `InsightsNavigator` → Removed (was 4th tab wrapper)

### API Endpoints (Health Intelligence)

```
GET /health-intelligence/{user_id}/agent-actions     → Proactive cards
GET /health-intelligence/{user_id}/learned-chains     → Discovered patterns
GET /health-intelligence/{user_id}/predictions        → Active predictions
GET /health-intelligence/{user_id}/belief-updates     → What Delta learned
GET /health-intelligence/{user_id}/uncertainty         → Knowledge gaps
GET /health-intelligence/{user_id}/learning-status     → Overall AI progress
GET /health-intelligence/{user_id}/state              → Health state
GET /health-intelligence/{user_id}/insights           → LLM-powered insights
```

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

- Conversational cards over dashboards
- Confidence indicators on every AI insight
- Timeline over static grids
- Frosted glass for AI-generated content
- Monochrome + indigo accent
- No circular gauges, no traffic light colors, no score numbers as hero elements

### Backend

- URL: `https://delta-80ht.onrender.com`
- Supabase for auth/profiles/storage
- Cold start timeout: 45s (Render)
- Chat timeout: 30s

### Tech Stack

- React Native + Expo
- TypeScript (strict)
- react-native-reanimated for animations
- @react-navigation (stack + bottom tabs)
- AsyncStorage for local caching
- Supabase for auth/profiles
