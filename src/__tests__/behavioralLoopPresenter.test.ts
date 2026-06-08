import { buildBehavioralLoopPresentation } from '../utils/behavioralLoopPresenter';
import { FEEDBACK_CONTRACT } from '../utils/feedbackContract';
import { MOBILE_DEMO_STATUS_FIXTURES } from '../utils/demoFixtures';
import type { BedroomStatusResponse } from '../services/api';

describe('behavioral loop presenter', () => {
  it('renders a safe empty state when backend is unavailable', () => {
    const presentation = buildBehavioralLoopPresentation(null, null, { backendUnavailable: true });

    expect(presentation.statusLabel).toBe('Backend unavailable');
    expect(presentation.eventLabel).toBe('No behavioral event extracted');
    expect(presentation.readinessLabel).toContain('Backend unavailable');
    expect(presentation.statePersistence).toBe('unavailable');
    expect(presentation.productDemoStatus).toBe('No product demo sequence summary yet');
    expect(presentation.latestProofPoint).toContain('Read-only demo visibility');
    expect(presentation.feedbackOptionsSummary).toContain('feedback options');
  });

  it('labels simulated dry-run state and summarizes the late-caffeine loop', () => {
    const status: BedroomStatusResponse = {
      user_id: 'eric-demo',
      runtime_status: {
        mode: 'dry-run',
        final_status: 'passed',
        latest_transcript: "I just drank a Monster and it's 10 PM.",
        backend_available: true,
        decision: {
          action: 'notify',
          channel: 'desktop',
          style: 'concise',
          message: 'Late caffeine logged. Probably make this the last one tonight.',
          reasoning: 'late caffeine detected',
          should_intervene: true,
          delivery_status: 'simulated',
          intervention_copy: 'Late caffeine logged. Probably make this the last one tonight.',
        },
        adaptation_summary: ['Concise tone preserved for future late-caffeine interventions.'],
        late_caffeine_state: {
          state_source: 'status JSON snapshot (simulated dry-run)',
          state_persistence: 'simulated',
          state_is_simulated: true,
          adaptation: {
            tone: 'concise',
            cooldown_minutes: 120,
            intervention_offset_minutes: 0,
            reduction_level: 0,
          },
        },
        state_provenance: {
          source: 'status JSON snapshot (simulated dry-run)',
          persistence: 'simulated',
          is_simulated: true,
          freshness: 'fresh',
          warnings: ['Simulated dry-run learning is not the persisted user profile.'],
        },
      },
      late_caffeine_state: {
        state_source: 'status JSON snapshot (simulated dry-run)',
        state_persistence: 'simulated',
        state_is_simulated: true,
        adaptation: {
          tone: 'concise',
          cooldown_minutes: 120,
          intervention_offset_minutes: 0,
          reduction_level: 0,
        },
      },
      last_detected_event: {
        event_type: 'caffeine',
        details: { source: 'Monster', time: '22:00' },
      },
      last_intervention_decision: null,
      error_state: null,
      recent_events: [],
      recent_interventions: [],
    };

    const presentation = buildBehavioralLoopPresentation(null, status);

    expect(presentation.statusLabel).toBe('passed');
    expect(presentation.latestTranscript).toContain('Monster');
    expect(presentation.eventLabel).toBe('caffeine');
    expect(presentation.eventDetail).toBe('Monster / 22:00');
    expect(presentation.decisionLabel).toBe('notify');
    expect(presentation.stateIsSimulated).toBe(true);
    expect(presentation.stateWarning).toContain('Simulated dry-run state');
    expect(presentation.tone).toBe('concise');
    expect(presentation.feedbackExplanation).toContain('No feedback outcome');
  });

  it('surfaces Supabase persistence warnings without calling mutation APIs', () => {
    const status: BedroomStatusResponse = {
      user_id: 'eric-demo',
      runtime_status: {
        final_status: 'idle',
        persisted_state_status: {
          status: 'paused-or-unreachable',
          reason: 'Supabase is unavailable or paused. Dry-run mode remains available. Persisted learning is blocked until Supabase is restored.',
        },
      },
      persisted_state_status: {
        status: 'paused-or-unreachable',
        reason: 'Supabase is unavailable or paused. Dry-run mode remains available. Persisted learning is blocked until Supabase is restored.',
      },
      last_detected_event: null,
      last_intervention_decision: null,
      error_state: null,
      recent_events: [],
      recent_interventions: [],
    };

    const presentation = buildBehavioralLoopPresentation(null, status);

    expect(presentation.stateWarning).toContain('Supabase is unavailable or paused');
    expect(presentation.backendStatus).toBe('paused-or-unreachable');
  });

  it('keeps simulated local status distinct when persisted state is unavailable', () => {
    const status: BedroomStatusResponse = {
      user_id: 'eric-demo',
      runtime_status: {
        final_status: 'passed',
        backend_available: true,
        late_caffeine_state: {
          state_source: 'status JSON snapshot (simulated dry-run)',
          state_persistence: 'simulated',
          state_is_simulated: true,
          adaptation: { tone: 'soft' },
        },
        persisted_state_status: {
          status: 'paused-or-unreachable',
          reason: 'Supabase is unavailable or paused. Dry-run mode remains available. Persisted learning is blocked until Supabase is restored.',
        },
      },
      late_caffeine_state: {
        state_source: 'status JSON snapshot (simulated dry-run)',
        state_persistence: 'simulated',
        state_is_simulated: true,
        adaptation: { tone: 'soft' },
      },
      persisted_state_status: {
        status: 'paused-or-unreachable',
        reason: 'Supabase is unavailable or paused. Dry-run mode remains available. Persisted learning is blocked until Supabase is restored.',
      },
      last_detected_event: null,
      last_intervention_decision: null,
      error_state: null,
      recent_events: [],
      recent_interventions: [],
    };

    const presentation = buildBehavioralLoopPresentation(null, status);

    expect(presentation.stateIsSimulated).toBe(true);
    expect(presentation.stateWarning).toContain('Simulated dry-run state');
    expect(presentation.stateWarning).toContain('Persisted state unavailable');
    expect(presentation.readinessLabel).toContain('persisted state unavailable');
  });

  it('renders product demo summary and latest proof point when available', () => {
    const status: BedroomStatusResponse = {
      user_id: 'eric-demo',
      runtime_status: {
        final_status: 'passed',
        backend_available: true,
        product_demo_summary: {
          final_demo_readiness_status: 'ready_for_guided_dry_run_demo',
          scenarios_run: 5,
          scenarios_passed: 5,
          scenarios_failed: 0,
          scenarios: [
            {
              scenario: 'ambient_noise',
              product_point: 'Delta can stay silent when input is ambient or non-behavioral.',
              passed: true,
            },
            {
              scenario: 'late_caffeine_after_remind_earlier_feedback',
              product_point: 'Delta can learn a timing preference and shift future warnings earlier.',
              passed: true,
            },
          ],
        },
      },
      last_detected_event: null,
      last_intervention_decision: null,
      error_state: null,
      recent_events: [],
      recent_interventions: [],
    };

    const presentation = buildBehavioralLoopPresentation(null, status);

    expect(presentation.productDemoStatus).toContain('ready_for_guided_dry_run_demo');
    expect(presentation.productDemoStatus).toContain('5/5 passed');
    expect(presentation.productDemoScenarioSummary).toBe('5 scenarios; 0 failed');
    expect(presentation.latestProofPoint).toContain('shift future warnings earlier');
  });

  it('maps canonical feedback options to read-only UX explanations', () => {
    expect(FEEDBACK_CONTRACT.map((option) => option.internalOutcome)).toEqual([
      'good_call',
      'too_much',
      'not_useful',
      'wrong_timing',
      'remind_earlier',
      'remind_later',
      'misunderstood',
      'dont_mention_again',
    ]);

    const presentation = buildBehavioralLoopPresentation(null, MOBILE_DEMO_STATUS_FIXTURES.first_time_late_caffeine);

    expect(presentation.feedbackLabel).toBe('good_call');
    expect(presentation.feedbackExplanation).toContain('Good call');
    expect(presentation.feedbackExplanation).toContain('eligible');
  });

  it('uses shared mobile fixtures for unavailable and ambient states', () => {
    const unavailable = buildBehavioralLoopPresentation(null, MOBILE_DEMO_STATUS_FIXTURES.supabase_unavailable);
    const ambient = buildBehavioralLoopPresentation(null, MOBILE_DEMO_STATUS_FIXTURES.ambient_filtered);

    expect(unavailable.stateWarning).toContain('Supabase');
    expect(ambient.eventLabel).toBe('No behavioral event extracted');
    expect(ambient.decisionLabel).toBe('stay silent');
  });
});
