import type {
  BehavioralDashboardState,
  BehavioralEvent,
  BehavioralIntervention,
  BehavioralLoopState,
  BedroomRuntimeStatus,
  BedroomStatusResponse,
} from '../services/api';
import { FEEDBACK_CONTRACT, feedbackOptionForOutcome } from './feedbackContract';

export interface BehavioralLoopPresentation {
  statusLabel: string;
  productDemoStatus: string;
  latestProofPoint: string;
  productDemoScenarioSummary: string;
  readinessLabel: string;
  stateSource: string;
  statePersistence: string;
  stateIsSimulated: boolean;
  stateFreshness: string;
  stateWarning: string;
  latestTranscript: string;
  eventLabel: string;
  eventDetail: string;
  decisionLabel: string;
  interventionCopy: string;
  feedbackLabel: string;
  feedbackExplanation: string;
  feedbackOptionsSummary: string;
  adaptationSummary: string;
  tone: string;
  cooldown: string;
  timingOffset: string;
  reductionLevel: string;
  backendStatus: string;
}

function compact(value: unknown, fallback = 'unavailable'): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function latestEvent(state: BehavioralDashboardState | null, status: BedroomStatusResponse | null, runtime: BedroomRuntimeStatus | null): BehavioralEvent | null {
  return (
    status?.last_detected_event ||
    runtime?.last_detected_event ||
    runtime?.extracted_events?.[0] ||
    status?.recent_events?.[0] ||
    state?.recent_events?.[0] ||
    null
  );
}

function latestDecision(state: BehavioralDashboardState | null, status: BedroomStatusResponse | null, runtime: BedroomRuntimeStatus | null): BehavioralIntervention | null {
  return (
    status?.last_intervention_decision ||
    runtime?.last_intervention_decision ||
    runtime?.decision ||
    status?.recent_interventions?.[0] ||
    state?.interventions?.[0] ||
    null
  );
}

function lateCaffeineState(state: BehavioralDashboardState | null, status: BedroomStatusResponse | null, runtime: BedroomRuntimeStatus | null): BehavioralLoopState | null {
  return (
    status?.late_caffeine_state ||
    runtime?.late_caffeine_state ||
    runtime?.behavioral_loop?.late_caffeine ||
    state?.behavioral_loop?.late_caffeine ||
    null
  );
}

export function buildBehavioralLoopPresentation(
  state: BehavioralDashboardState | null,
  status: BedroomStatusResponse | null,
  options: { backendUnavailable?: boolean; loading?: boolean } = {}
): BehavioralLoopPresentation {
  const runtime = status?.runtime_status || state?.runtime_status || null;
  const productDemoSummary = runtime?.product_demo_summary || state?.product_demo_summary || null;
  const productDemoScenarios = Array.isArray(productDemoSummary?.scenarios) ? productDemoSummary.scenarios : [];
  const latestProductScenario = productDemoScenarios[productDemoScenarios.length - 1];
  const event = latestEvent(state, status, runtime);
  const decision = latestDecision(state, status, runtime);
  const loopState = lateCaffeineState(state, status, runtime);
  const provenance = status?.state_provenance || runtime?.state_provenance;
  const persistedStatus = status?.persisted_state_status || runtime?.persisted_state_status;
  const adaptation = objectRecord(loopState?.adaptation);
  const eventDetails = objectRecord(event?.details);
  const decisionContext = objectRecord(decision?.context);
  const runtimeSummary = stringList(runtime?.adaptation_summary);
  const decisionSummary = stringList(decision?.adaptation_summary);
  const stateSummary = stringList(adaptation.last_feedback_summary);
  const warnings = [
    ...stringList(provenance?.warnings),
    ...(persistedStatus?.status && persistedStatus.status !== 'reachable' ? [persistedStatus.reason || `Persisted state ${persistedStatus.status}.`] : []),
  ].filter(Boolean);
  const persistedUnavailable = Boolean(persistedStatus?.status && persistedStatus.status !== 'reachable');
  const persistedUnavailableMessage = 'Persisted state unavailable. Demo status may still be visible if local backend is running.';

  const statePersistence = compact(
    loopState?.state_persistence ||
    runtime?.state_persistence ||
    provenance?.persistence ||
    (loopState ? 'snapshot' : 'unavailable')
  );
  const stateIsSimulated =
    loopState?.state_is_simulated === true ||
    runtime?.state_is_simulated === true ||
    provenance?.is_simulated === true ||
    statePersistence === 'simulated';
  const backendStatus = options.backendUnavailable
    ? 'unavailable'
    : runtime?.backend_available === false
      ? 'unavailable'
      : runtime?.backend_available === true
        ? 'connected'
        : compact(state?.system_status?.backend || persistedStatus?.status, 'unknown');
  const statusLabel = options.backendUnavailable
    ? 'Backend unavailable'
    : options.loading
      ? 'Syncing'
      : compact(runtime?.final_status || runtime?.pipeline_stage || state?.live_audio_state?.status, 'idle');
  const eventLabel = event
    ? compact(event.event_type, 'event').replace(/_/g, ' ')
    : 'No behavioral event extracted';
  const eventDetail = event
    ? [
        compact(eventDetails.source, 'source unknown'),
        compact(eventDetails.time, 'time unknown'),
      ].join(' / ')
    : 'Delta has no late-caffeine event to act on.';
  const action = decision?.should_intervene === false || decision?.delivery_status === 'skipped'
    ? 'stay silent'
    : compact(decision?.action, 'pending');
  const interventionCopy =
    runtime?.intervention_copy ||
    decision?.intervention_copy ||
    (typeof decisionContext.intervention_copy === 'string' ? decisionContext.intervention_copy : '') ||
    decision?.message ||
    'No intervention copy selected.';
  const latestTranscript =
    runtime?.latest_transcript ||
    runtime?.last_transcript ||
    status?.last_transcript ||
    state?.live_audio_state?.latest_transcript ||
    'No observation has been processed yet.';
  const adaptationSummaryBase = runtimeSummary[0] || decisionSummary[0] || stateSummary[0] || 'No feedback adaptation has been recorded yet.';
  const feedbackLabel = compact(runtime?.feedback || runtime?.feedback_submitted || decision?.feedback_outcome, 'none');
  const feedbackOption = feedbackOptionForOutcome(feedbackLabel);
  const hasBackoffLearning = !stateIsSimulated && (
    ['too_much', 'not_useful', 'dont_mention_again'].includes(feedbackLabel) ||
    Number(adaptation.reduction_level || 0) > 0 ||
    Boolean(adaptation.suppress_until)
  );

  return {
    statusLabel,
    productDemoStatus: productDemoSummary
      ? `${compact(productDemoSummary.final_demo_readiness_status, 'demo summary available')} (${compact(productDemoSummary.scenarios_passed, '0')}/${compact(productDemoSummary.scenarios_run, '0')} passed)`
      : 'No product demo sequence summary yet',
    latestProofPoint: latestProductScenario?.product_point || 'Read-only demo visibility. Run the product demo command to populate proof points.',
    productDemoScenarioSummary: productDemoSummary
      ? `${compact(productDemoSummary.scenarios_run, '0')} scenarios; ${compact(productDemoSummary.scenarios_failed, '0')} failed`
      : 'No sequence run has been reported.',
    readinessLabel: backendStatus === 'connected'
      ? persistedUnavailable
        ? 'Read-only demo status available; persisted state unavailable.'
        : 'Read-only demo status available'
      : 'Backend unavailable; mobile is showing a safe empty state',
    stateSource: compact(loopState?.state_source || runtime?.state_source || provenance?.source, loopState ? 'status snapshot' : 'unavailable'),
    statePersistence,
    stateIsSimulated,
    stateFreshness: compact(provenance?.freshness || (runtime?.status_age_seconds && runtime.status_age_seconds > 120 ? 'stale' : undefined), 'unknown'),
    stateWarning: stateIsSimulated
      ? persistedUnavailable
        ? `Simulated dry-run state, not the persisted user profile. ${persistedUnavailableMessage}`
        : 'Simulated dry-run state, not the persisted user profile.'
      : warnings[0] || 'State provenance is labeled when available.',
    latestTranscript,
    eventLabel,
    eventDetail,
    decisionLabel: action.replace(/_/g, ' '),
    interventionCopy,
    feedbackLabel,
    feedbackExplanation: feedbackOption
      ? `${feedbackOption.label}: ${feedbackOption.exampleAdaptationSummary}`
      : 'No feedback outcome has been applied. Feedback options are shown as read-only demo guidance.',
    feedbackOptionsSummary: `${FEEDBACK_CONTRACT.length} feedback options documented for the late-caffeine demo loop.`,
    adaptationSummary: hasBackoffLearning
      ? `Delta learned to back off. ${adaptationSummaryBase}`
      : adaptationSummaryBase,
    tone: compact(adaptation.tone),
    cooldown: `${compact(adaptation.cooldown_minutes)} min`,
    timingOffset: `${compact(adaptation.intervention_offset_minutes)} min`,
    reductionLevel: compact(adaptation.reduction_level),
    backendStatus,
  };
}
