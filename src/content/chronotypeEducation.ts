/**
 * Chronotype Educational Content
 *
 * Provides educational information about chronotypes, their characteristics,
 * optimal schedules, and alignment tips.
 */

export type ChronotypeId = 'early_bird' | 'intermediate' | 'night_owl';

export interface ChronotypeInfo {
  id: ChronotypeId;
  name: string;
  emoji: string;
  description: string;
  characteristics: string[];
  peakHours: {
    alertness: string;
    creativity: string;
    physical: string;
  };
  optimalSchedule: {
    wakeTime: string;
    sleepTime: string;
    workoutWindow: string;
    focusWindow: string;
    windDown: string;
  };
  tips: string[];
  challenges: string[];
}

export const CHRONOTYPE_DATA: Record<ChronotypeId, ChronotypeInfo> = {
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    emoji: '🌅',
    description:
      'You naturally wake up early and feel most energized in the morning. Your body clock runs slightly ahead of the average person.',
    characteristics: [
      'Feel most alert in the morning hours',
      'Energy naturally declines after 3-4 PM',
      'Prefer going to bed early (before 10 PM)',
      'Wake up easily without an alarm',
      'Most productive in the first half of the day',
    ],
    peakHours: {
      alertness: '8 AM - 12 PM',
      creativity: '10 AM - 12 PM',
      physical: '7 AM - 11 AM',
    },
    optimalSchedule: {
      wakeTime: '5:30 - 6:30 AM',
      sleepTime: '9:00 - 10:00 PM',
      workoutWindow: '6:00 - 8:00 AM',
      focusWindow: '8:00 AM - 12:00 PM',
      windDown: '8:00 PM onwards',
    },
    tips: [
      'Schedule important meetings and deep work for mornings',
      'Avoid caffeine after 12 PM to protect sleep',
      'Use evening time for lighter tasks and relaxation',
      'Be mindful of social events that run late',
      'Expose yourself to bright light immediately upon waking',
    ],
    challenges: [
      'Evening social events may conflict with natural sleep time',
      'May feel fatigued during late afternoon meetings',
      'Partners with different chronotypes may have schedule conflicts',
    ],
  },
  intermediate: {
    id: 'intermediate',
    name: 'Intermediate',
    emoji: '☀️',
    description:
      'You fall in the middle of the spectrum with a balanced energy pattern. You can adapt to both early and late schedules with relative ease.',
    characteristics: [
      'Flexible energy throughout the day',
      'Can adapt to various schedules',
      'Steady alertness from mid-morning to early evening',
      'Moderate difficulty with very early or very late hours',
      'Sleep needs typically align with conventional schedules',
    ],
    peakHours: {
      alertness: '10 AM - 2 PM',
      creativity: '11 AM - 1 PM',
      physical: '10 AM - 6 PM',
    },
    optimalSchedule: {
      wakeTime: '7:00 - 8:00 AM',
      sleepTime: '10:30 - 11:30 PM',
      workoutWindow: '10:00 AM - 7:00 PM',
      focusWindow: '10:00 AM - 2:00 PM',
      windDown: '9:30 PM onwards',
    },
    tips: [
      'Take advantage of your adaptability for flexible scheduling',
      'Use mid-morning for most demanding cognitive tasks',
      'Maintain consistent sleep times even on weekends',
      'Afternoon is great for collaborative work and meetings',
      'Light exercise can help boost afternoon energy',
    ],
    challenges: [
      'May try to push too late or too early, disrupting rhythm',
      'Social pressure to accommodate others\' schedules',
      'Less dramatic peaks may feel like lower productivity',
    ],
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    emoji: '🦉',
    description:
      'You naturally feel more alert and energized later in the day and evening. Your body clock runs slightly behind the average person.',
    characteristics: [
      'Difficulty waking up early, especially before 8 AM',
      'Energy and alertness increase throughout the day',
      'Peak performance in late afternoon and evening',
      'Prefer going to bed after midnight',
      'Creative bursts often happen at night',
    ],
    peakHours: {
      alertness: '2 PM - 9 PM',
      creativity: '6 PM - 10 PM',
      physical: '4 PM - 8 PM',
    },
    optimalSchedule: {
      wakeTime: '8:00 - 9:30 AM',
      sleepTime: '12:00 - 1:30 AM',
      workoutWindow: '4:00 - 8:00 PM',
      focusWindow: '3:00 PM - 8:00 PM',
      windDown: '11:00 PM onwards',
    },
    tips: [
      'Avoid scheduling critical tasks for early morning',
      'Use morning hours for routine, low-effort tasks',
      'Block your peak evening hours for deep work',
      'Get morning light exposure to help regulate sleep',
      'Consider jobs or schedules that allow flexible hours',
    ],
    challenges: [
      'Traditional 9-5 schedules may feel exhausting',
      'Morning meetings can catch you at your lowest',
      'Society often favors early birds, creating pressure',
      'May need to plan ahead for early commitments',
    ],
  },
};

// Alignment score explanations
export interface AlignmentTip {
  range: [number, number]; // min, max score
  label: string;
  description: string;
  suggestions: string[];
}

export const ALIGNMENT_TIPS: AlignmentTip[] = [
  {
    range: [80, 100],
    label: 'Excellent Alignment',
    description:
      'Your daily patterns are well-matched to your natural chronotype. Keep up the great work!',
    suggestions: [
      'Maintain your current sleep and activity schedule',
      'Minor variations are fine, but avoid major shifts',
      'Use this alignment to maximize productivity',
    ],
  },
  {
    range: [60, 79],
    label: 'Good Alignment',
    description:
      'You\'re mostly aligned with your chronotype with room for small improvements.',
    suggestions: [
      'Try shifting sleep time 15-30 minutes closer to optimal',
      'Move workouts to your peak energy window if possible',
      'Reduce screen time in the hour before bed',
    ],
  },
  {
    range: [40, 59],
    label: 'Moderate Alignment',
    description:
      'Your schedule has some conflicts with your natural rhythm. Adjustments could improve energy.',
    suggestions: [
      'Gradually shift your sleep schedule (15 min every few days)',
      'Prioritize consistent wake times, even on weekends',
      'Consider restructuring work hours if flexible',
      'Avoid caffeine and heavy meals near bedtime',
    ],
  },
  {
    range: [20, 39],
    label: 'Poor Alignment',
    description:
      'Your current schedule significantly conflicts with your chronotype, likely affecting energy and mood.',
    suggestions: [
      'Review your commitments - can any be rescheduled?',
      'Focus on sleep consistency as the first priority',
      'Use light exposure strategically (bright morning, dim evening)',
      'Consider discussing schedule flexibility with work/school',
    ],
  },
  {
    range: [0, 19],
    label: 'Severely Misaligned',
    description:
      'Your schedule is working against your biology. This can impact health, mood, and cognitive function.',
    suggestions: [
      'Make sleep schedule changes a top priority',
      'Start with wake time - anchor it consistently',
      'Seek support if work requirements are the cause',
      'Consider consulting a sleep specialist',
      'Be patient - adjustment takes 1-2 weeks',
    ],
  },
];

export function getAlignmentTip(score: number): AlignmentTip {
  return (
    ALIGNMENT_TIPS.find(tip => score >= tip.range[0] && score <= tip.range[1]) ??
    ALIGNMENT_TIPS[ALIGNMENT_TIPS.length - 1]
  );
}

export function getChronotypeInfo(chronotype: ChronotypeId): ChronotypeInfo {
  return CHRONOTYPE_DATA[chronotype] ?? CHRONOTYPE_DATA.intermediate;
}
