/**
 * Factor Explanations
 *
 * Provides educational content about factors that affect recovery,
 * energy, and overall health metrics.
 */

export interface FactorExplanation {
  id: string;
  name: string;
  category: 'sleep' | 'activity' | 'nutrition' | 'stress' | 'lifestyle';
  description: string;
  howItAffects: string;
  tips: string[];
  idealRange?: string;
  icon: string;
}

export const FACTOR_EXPLANATIONS: Record<string, FactorExplanation> = {
  // Sleep factors
  sleep_quality: {
    id: 'sleep_quality',
    name: 'Sleep Quality',
    category: 'sleep',
    description: 'A measure of how restorative your sleep was, based on time in deep and REM stages.',
    howItAffects: 'High-quality sleep is essential for physical recovery, memory consolidation, and hormone regulation. Poor sleep quality can leave you feeling tired even after 8 hours in bed.',
    tips: [
      'Keep your bedroom cool (65-68°F / 18-20°C)',
      'Avoid screens 1 hour before bed',
      'Maintain consistent sleep/wake times',
      'Limit caffeine after 2 PM',
    ],
    idealRange: '85-100% efficiency',
    icon: 'moon',
  },
  sleep_duration: {
    id: 'sleep_duration',
    name: 'Sleep Duration',
    category: 'sleep',
    description: 'Total time spent asleep, not just time in bed.',
    howItAffects: 'Insufficient sleep impairs cognitive function, mood, and physical recovery. Chronic sleep deprivation is linked to numerous health issues.',
    tips: [
      'Aim for 7-9 hours for most adults',
      'Track your personal optimal duration',
      'Prioritize sleep over late-night activities',
      'Nap strategically if needed (20-30 min before 3 PM)',
    ],
    idealRange: '7-9 hours',
    icon: 'bed',
  },
  sleep_consistency: {
    id: 'sleep_consistency',
    name: 'Sleep Consistency',
    category: 'sleep',
    description: 'How regular your sleep and wake times are across days.',
    howItAffects: 'Irregular sleep patterns confuse your circadian rhythm, making it harder to fall asleep and wake up naturally. Consistency improves sleep quality over time.',
    tips: [
      'Set a fixed wake time, even on weekends',
      'Create a calming pre-sleep routine',
      'Avoid sleeping in more than 1 hour on weekends',
      'Use light exposure to anchor your rhythm',
    ],
    icon: 'time',
  },
  deep_sleep: {
    id: 'deep_sleep',
    name: 'Deep Sleep',
    category: 'sleep',
    description: 'The most restorative sleep stage, crucial for physical recovery.',
    howItAffects: 'Deep sleep is when your body repairs tissues, builds muscle, and strengthens immunity. Too little deep sleep leaves you physically fatigued.',
    tips: [
      'Exercise regularly (but not too close to bedtime)',
      'Avoid alcohol close to bedtime',
      'Keep your room dark and quiet',
      'Consider white noise if your environment is noisy',
    ],
    idealRange: '1-2 hours per night',
    icon: 'bed',
  },
  rem_sleep: {
    id: 'rem_sleep',
    name: 'REM Sleep',
    category: 'sleep',
    description: 'Rapid Eye Movement sleep, important for cognitive function and emotional processing.',
    howItAffects: 'REM sleep supports learning, memory consolidation, and emotional regulation. Lack of REM can impair creativity and mood stability.',
    tips: [
      'Avoid alcohol (it suppresses REM)',
      'Manage stress and anxiety',
      'Get enough total sleep (REM increases in later cycles)',
      'Maintain consistent sleep schedule',
    ],
    idealRange: '1.5-2 hours per night',
    icon: 'cloudy-night',
  },

  // Activity factors
  training_load: {
    id: 'training_load',
    name: 'Training Load',
    category: 'activity',
    description: 'The cumulative stress placed on your body from exercise over recent days.',
    howItAffects: 'Appropriate training load builds fitness. Too much causes overtraining; too little leads to detraining. Balance is key for progress.',
    tips: [
      'Follow the 10% rule (increase weekly volume by max 10%)',
      'Include easy days and rest days',
      'Listen to your body - fatigue signals matter',
      'Periodize training with recovery weeks',
    ],
    icon: 'barbell',
  },
  activity_balance: {
    id: 'activity_balance',
    name: 'Activity Balance',
    category: 'activity',
    description: 'The ratio between your recent training load and your recovery capacity.',
    howItAffects: 'When training exceeds recovery capacity, performance suffers and injury risk increases. Balanced activity supports consistent progress.',
    tips: [
      'Match hard training days with good sleep',
      'Include active recovery (light movement)',
      'Monitor how you feel, not just metrics',
      'Adjust training when life stress is high',
    ],
    icon: 'scale',
  },
  steps: {
    id: 'steps',
    name: 'Daily Steps',
    category: 'activity',
    description: 'Non-exercise activity throughout your day.',
    howItAffects: 'Regular movement throughout the day supports metabolism, mood, and cardiovascular health. Sitting all day negates some benefits of formal exercise.',
    tips: [
      'Aim for 7,000-10,000 steps daily',
      'Take walking breaks during work',
      'Use stairs when possible',
      'Walk during phone calls',
    ],
    idealRange: '7,000-10,000 steps',
    icon: 'footsteps',
  },
  workout_intensity: {
    id: 'workout_intensity',
    name: 'Workout Intensity',
    category: 'activity',
    description: 'How hard you trained relative to your capacity.',
    howItAffects: 'High-intensity workouts create more training stress but also require more recovery. Varying intensity prevents plateaus and overtraining.',
    tips: [
      'Include both high and low intensity sessions',
      'Use heart rate zones to guide effort',
      'Allow 48 hours between high-intensity sessions',
      'Reduce intensity when under-recovered',
    ],
    icon: 'flash',
  },

  // Nutrition factors
  calorie_balance: {
    id: 'calorie_balance',
    name: 'Calorie Balance',
    category: 'nutrition',
    description: 'The relationship between calories consumed and calories burned.',
    howItAffects: 'Calorie balance determines body composition changes. Deficits support fat loss but can impair recovery; surpluses support muscle gain but excess leads to fat gain.',
    tips: [
      'Track intake for awareness, not obsession',
      'Fuel appropriately for training demands',
      'Avoid extreme deficits that impact recovery',
      'Consider meal timing around workouts',
    ],
    icon: 'flame',
  },
  protein_intake: {
    id: 'protein_intake',
    name: 'Protein Intake',
    category: 'nutrition',
    description: 'Daily protein consumption relative to your needs.',
    howItAffects: 'Protein is essential for muscle repair, immune function, and satiety. Inadequate protein impairs recovery and can lead to muscle loss.',
    tips: [
      'Aim for 1.6-2.2g per kg of body weight if active',
      'Spread protein across meals (20-40g per meal)',
      'Include protein at breakfast',
      'Quality sources: lean meats, fish, eggs, legumes',
    ],
    idealRange: '1.6-2.2g per kg body weight',
    icon: 'nutrition',
  },
  hydration: {
    id: 'hydration',
    name: 'Hydration',
    category: 'nutrition',
    description: 'Your fluid intake relative to your needs.',
    howItAffects: 'Even mild dehydration impairs cognitive function, mood, and physical performance. Proper hydration supports every bodily function.',
    tips: [
      'Drink water throughout the day, not just when thirsty',
      'Monitor urine color (pale yellow is ideal)',
      'Increase intake during exercise and hot weather',
      'Electrolytes matter during prolonged activity',
    ],
    icon: 'water',
  },
  meal_timing: {
    id: 'meal_timing',
    name: 'Meal Timing',
    category: 'nutrition',
    description: 'When you eat relative to your circadian rhythm and activity.',
    howItAffects: 'Eating patterns affect energy levels, sleep quality, and metabolic health. Late heavy meals can disrupt sleep; strategic timing supports training.',
    tips: [
      'Avoid large meals within 2-3 hours of bed',
      'Eat protein and carbs after training',
      'Consider time-restricted eating (12-14 hour window)',
      'Don\'t skip breakfast if you train in the morning',
    ],
    icon: 'time',
  },

  // Stress factors
  stress_level: {
    id: 'stress_level',
    name: 'Stress Level',
    category: 'stress',
    description: 'Your psychological and physiological stress load.',
    howItAffects: 'Chronic stress impairs recovery, sleep, immune function, and decision-making. Your body doesn\'t distinguish between life stress and training stress.',
    tips: [
      'Practice daily stress management (meditation, breathing)',
      'Reduce training load during high-stress periods',
      'Prioritize sleep when stressed',
      'Identify and address sources of chronic stress',
    ],
    icon: 'pulse',
  },
  hrv_trend: {
    id: 'hrv_trend',
    name: 'HRV Trend',
    category: 'stress',
    description: 'Changes in your heart rate variability over recent days.',
    howItAffects: 'Declining HRV often indicates accumulated stress or inadequate recovery. Improving HRV suggests good adaptation and readiness.',
    tips: [
      'Track HRV consistently (same time, conditions)',
      'Use trends, not single readings',
      'Rest when HRV drops significantly',
      'HRV improves with consistent sleep and moderate training',
    ],
    icon: 'analytics',
  },
  resting_hr_trend: {
    id: 'resting_hr_trend',
    name: 'Resting HR Trend',
    category: 'stress',
    description: 'Changes in your resting heart rate over time.',
    howItAffects: 'Elevated resting HR can indicate illness, overtraining, or inadequate recovery. Lower resting HR generally indicates better cardiovascular fitness.',
    tips: [
      'Measure first thing in the morning',
      'Note increases of 5+ bpm from baseline',
      'Rest or reduce training when elevated',
      'Fitness training gradually lowers resting HR',
    ],
    icon: 'heart',
  },

  // Lifestyle factors
  alcohol_consumption: {
    id: 'alcohol_consumption',
    name: 'Alcohol Consumption',
    category: 'lifestyle',
    description: 'Recent alcohol intake and its effects.',
    howItAffects: 'Alcohol impairs sleep quality (especially REM), dehydrates the body, and inhibits muscle protein synthesis. Even moderate amounts affect recovery.',
    tips: [
      'Avoid alcohol within 3 hours of bed',
      'Stay hydrated when drinking',
      'Consider alcohol-free days each week',
      'Be mindful of timing relative to training',
    ],
    icon: 'wine',
  },
  caffeine_timing: {
    id: 'caffeine_timing',
    name: 'Caffeine Timing',
    category: 'lifestyle',
    description: 'When you consume caffeine relative to sleep.',
    howItAffects: 'Caffeine has a half-life of 5-6 hours. Late caffeine can delay sleep onset and reduce sleep quality even if you fall asleep.',
    tips: [
      'Stop caffeine 8-10 hours before bed',
      'Limit total daily intake to 400mg',
      'Wait 90 minutes after waking for first cup',
      'Consider caffeine-free days to reset tolerance',
    ],
    icon: 'cafe',
  },
  screen_time: {
    id: 'screen_time',
    name: 'Evening Screen Time',
    category: 'lifestyle',
    description: 'Blue light exposure and mental stimulation before bed.',
    howItAffects: 'Blue light suppresses melatonin production. Engaging content (social media, news) can increase alertness when you should be winding down.',
    tips: [
      'Use night mode on devices after sunset',
      'Create a 30-60 minute screen-free period before bed',
      'Avoid stimulating content close to bedtime',
      'Consider blue light blocking glasses',
    ],
    icon: 'phone-portrait',
  },
};

export function getFactorExplanation(factorId: string): FactorExplanation | null {
  // Try exact match first
  if (FACTOR_EXPLANATIONS[factorId]) {
    return FACTOR_EXPLANATIONS[factorId];
  }

  // Try normalized key (lowercase, underscored)
  const normalizedId = factorId.toLowerCase().replace(/\s+/g, '_');
  if (FACTOR_EXPLANATIONS[normalizedId]) {
    return FACTOR_EXPLANATIONS[normalizedId];
  }

  // Try partial match
  const partialMatch = Object.keys(FACTOR_EXPLANATIONS).find(key =>
    normalizedId.includes(key) || key.includes(normalizedId)
  );
  if (partialMatch) {
    return FACTOR_EXPLANATIONS[partialMatch];
  }

  return null;
}

export function getCategoryColor(category: FactorExplanation['category']): string {
  const colors: Record<FactorExplanation['category'], string> = {
    sleep: '#6366F1',
    activity: '#22C55E',
    nutrition: '#F97316',
    stress: '#EF4444',
    lifestyle: '#8B5CF6',
  };
  return colors[category];
}

export function getCategoryIcon(category: FactorExplanation['category']): string {
  const icons: Record<FactorExplanation['category'], string> = {
    sleep: 'moon',
    activity: 'barbell',
    nutrition: 'restaurant',
    stress: 'pulse',
    lifestyle: 'home',
  };
  return icons[category];
}
