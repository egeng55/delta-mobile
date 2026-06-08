export type FeedbackOption = {
  label: string;
  explanation: string;
  internalOutcome: string;
  policyEffect: string;
  toneEffect: string;
  cooldownEffect: string;
  frequencyEffect: string;
  suppressionEffect: string;
  timingOffsetEffect: string;
  exampleAdaptationSummary: string;
  reversible: boolean;
  availability: 'demo_and_future_real';
};

export const FEEDBACK_CONTRACT: FeedbackOption[] = [
  {
    label: 'Good call',
    explanation: 'The intervention helped or felt worth showing.',
    internalOutcome: 'good_call',
    policyEffect: 'Keep late-caffeine interventions eligible.',
    toneEffect: 'Preserve concise or direct copy.',
    cooldownEffect: 'Slightly reduce cooldown.',
    frequencyEffect: 'Maintain normal frequency.',
    suppressionEffect: 'Clear temporary suppression.',
    timingOffsetEffect: 'No timing shift.',
    exampleAdaptationSummary: 'Delta keeps this intervention eligible and may stay concise.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
  {
    label: 'Too much',
    explanation: 'The intervention was annoying, too frequent, or too forceful.',
    internalOutcome: 'too_much',
    policyEffect: 'Reduce intervention pressure for this category.',
    toneEffect: 'Soften future copy.',
    cooldownEffect: 'Increase cooldown substantially.',
    frequencyEffect: 'Reduce future frequency.',
    suppressionEffect: 'May temporarily suppress similar interventions.',
    timingOffsetEffect: 'No timing shift by default.',
    exampleAdaptationSummary: 'Delta softens tone, increases cooldown, reduces frequency, and may suppress similar interventions.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
  {
    label: 'Not useful',
    explanation: 'The intervention was understandable but did not help.',
    internalOutcome: 'not_useful',
    policyEffect: 'Lower usefulness confidence for similar contexts.',
    toneEffect: 'Use lower-pressure copy.',
    cooldownEffect: 'Increase cooldown.',
    frequencyEffect: 'Reduce future frequency.',
    suppressionEffect: 'May temporarily suppress if repeated.',
    timingOffsetEffect: 'No timing shift by default.',
    exampleAdaptationSummary: 'Delta reduces confidence that this intervention helps and becomes less frequent.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
  {
    label: 'Wrong timing',
    explanation: 'The content was reasonable, but it arrived at the wrong time.',
    internalOutcome: 'wrong_timing',
    policyEffect: 'Avoid aggressive adaptation; ask or infer earlier/later timing next.',
    toneEffect: 'Use low-pressure timing-aware copy.',
    cooldownEffect: 'Increase cooldown slightly.',
    frequencyEffect: 'Keep eligible but less urgent.',
    suppressionEffect: 'No category suppression.',
    timingOffsetEffect: 'Flag timing uncertainty without changing offset until earlier/later is known.',
    exampleAdaptationSummary: 'Delta treats this as a timing problem and should ask whether to remind earlier or later.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
  {
    label: 'Remind earlier',
    explanation: 'The intervention would be more useful before the behavior happens.',
    internalOutcome: 'remind_earlier',
    policyEffect: 'Keep intervention eligible and shift warning earlier.',
    toneEffect: 'Preserve concise copy.',
    cooldownEffect: 'Slightly reduce cooldown.',
    frequencyEffect: 'Maintain eligibility.',
    suppressionEffect: 'No suppression.',
    timingOffsetEffect: 'Move target intervention offset earlier.',
    exampleAdaptationSummary: 'Delta shifts future late-caffeine warnings earlier.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
  {
    label: 'Remind later',
    explanation: 'The intervention would be better later or with less urgency.',
    internalOutcome: 'remind_later',
    policyEffect: 'Keep intervention eligible but reduce urgency.',
    toneEffect: 'Use lower-pressure copy.',
    cooldownEffect: 'Increase cooldown slightly.',
    frequencyEffect: 'Slightly reduce frequency.',
    suppressionEffect: 'No suppression.',
    timingOffsetEffect: 'Move target intervention offset later.',
    exampleAdaptationSummary: 'Delta shifts future warnings later and treats them as less urgent.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
  {
    label: 'You misunderstood me',
    explanation: 'The observation or event extraction was wrong.',
    internalOutcome: 'misunderstood',
    policyEffect: 'Lower confidence in the extracted event and avoid strong adaptation.',
    toneEffect: 'Use low-pressure copy if this context appears again.',
    cooldownEffect: 'Increase cooldown modestly.',
    frequencyEffect: 'Reduce future frequency until confidence improves.',
    suppressionEffect: 'No hard suppression from one correction.',
    timingOffsetEffect: 'No timing shift.',
    exampleAdaptationSummary: 'Delta lowers confidence in the event extraction and avoids adapting too aggressively.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
  {
    label: "Don't mention this again",
    explanation: 'The user wants this intervention category suppressed.',
    internalOutcome: 'dont_mention_again',
    policyEffect: 'Suppress this intervention category unless re-enabled.',
    toneEffect: 'No message by default.',
    cooldownEffect: 'Set a long cooldown.',
    frequencyEffect: 'Reduce frequency to zero while suppression is active.',
    suppressionEffect: 'Activate category suppression.',
    timingOffsetEffect: 'No timing shift.',
    exampleAdaptationSummary: 'Delta suppresses this intervention category unless the user re-enables it.',
    reversible: true,
    availability: 'demo_and_future_real',
  },
];

export function feedbackOptionForOutcome(outcome?: string | null): FeedbackOption | undefined {
  return FEEDBACK_CONTRACT.find((option) => option.internalOutcome === outcome);
}
