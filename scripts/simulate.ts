#!/usr/bin/env npx ts-node
/**
 * Delta Health Data Simulator
 *
 * Generates realistic health data for different persona archetypes
 * and pushes it through the live API to test the intelligence engine.
 *
 * Usage:
 *   npx ts-node scripts/simulate.ts --profile    # Your profile, 3 months
 *   npx ts-node scripts/simulate.ts --personas   # Multiple persona simulations
 *   npx ts-node scripts/simulate.ts --all        # Both
 *
 * Personas:
 *   1. College Athlete (M, 21) - high training load, good sleep, high protein
 *   2. Busy Mom (F, 34) - fragmented sleep, stress spikes, inconsistent meals
 *   3. Sedentary Office Worker (M, 42) - low activity, poor sleep, high stress
 *   4. Weekend Warrior (M, 38) - sporadic intense workouts, okay diet
 *   5. Endurance Runner (F, 29) - high cardio, moderate strength, careful nutrition
 *   6. Stressed Exec (M, 50) - high stress, alcohol, poor recovery
 *   7. Health-Conscious Retiree (F, 65) - walking, yoga, consistent routine
 *   8. Night Shift Nurse (F, 31) - circadian disruption, variable sleep
 */

const BASE_URL = 'https://delta-80ht.onrender.com';

// ============================================================
// TYPES
// ============================================================

interface DayLog {
  meals: Array<{ meal: string; description?: string; calories_est?: number }>;
  calories_total: number | null;
  protein_grams: number | null;
  hydration_liters: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  bed_time: string | null;
  wake_time: string | null;
  energy_level: number | null;
  soreness_level: number | null;
  stress_level: number | null;
  alcohol_drinks: number;
  notes: string | null;
}

interface Persona {
  name: string;
  age: number;
  gender: 'male' | 'female';
  description: string;
  generate: (dayIndex: number, date: Date) => DayLog;
}

// ============================================================
// HELPERS
// ============================================================

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// Gaussian-ish random (sum of 3 uniforms)
function gaussRand(mean: number, stddev: number): number {
  const u = Math.random() + Math.random() + Math.random();
  return mean + stddev * (u - 1.5) / 0.5;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayOfWeek(date: Date): number {
  return date.getDay(); // 0=Sun, 6=Sat
}

function isWeekend(date: Date): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

async function apiPut(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ============================================================
// PERSONA GENERATORS
// ============================================================

function createCollegeAthlete(): Persona {
  // State that drifts over time
  let fatigueAccum = 0;
  let restDaysInRow = 0;

  return {
    name: 'College Athlete',
    age: 21,
    gender: 'male',
    description: 'D1 swimmer. High training load, structured meals, good sleep most nights. Occasional parties on weekends.',
    generate(dayIndex, date) {
      const dow = dayOfWeek(date);
      const weekend = isWeekend(date);
      const isPartyNight = weekend && Math.random() < 0.3;
      const isRestDay = dow === 0 || (fatigueAccum > 8 && Math.random() < 0.5);

      // Training effect on fatigue
      if (!isRestDay) {
        fatigueAccum += rand(1.5, 3);
        restDaysInRow = 0;
      } else {
        fatigueAccum = Math.max(0, fatigueAccum - 3);
        restDaysInRow++;
      }

      const sleepHours = isPartyNight ? rand(4, 5.5) : gaussRand(7.5, 0.8);
      const sleepQuality = isPartyNight ? randInt(1, 2) : clamp(Math.round(sleepHours > 7 ? rand(3.5, 5) : rand(2, 4)), 1, 5);
      const energyBase = isPartyNight ? 2 : (sleepHours > 7 ? 4 : 3);
      const energyLevel = clamp(Math.round(energyBase - fatigueAccum * 0.15 + (isRestDay ? 1 : 0)), 1, 5);
      const sorenessLevel = clamp(Math.round(fatigueAccum * 0.4), 1, 5);

      const calories = isRestDay ? randInt(2400, 2800) : randInt(3000, 3600);
      const protein = isRestDay ? randInt(140, 170) : randInt(180, 220);

      return {
        meals: isRestDay
          ? [
              { meal: 'Breakfast', description: 'Eggs, toast, fruit', calories_est: randInt(500, 700) },
              { meal: 'Lunch', description: 'Chicken bowl', calories_est: randInt(700, 900) },
              { meal: 'Dinner', description: 'Pasta with meat sauce', calories_est: randInt(800, 1000) },
            ]
          : [
              { meal: 'Breakfast', description: 'Oatmeal, protein shake, banana', calories_est: randInt(600, 800) },
              { meal: 'Post-Workout', description: 'Protein shake, granola bar', calories_est: randInt(400, 500) },
              { meal: 'Lunch', description: 'Rice, chicken, broccoli', calories_est: randInt(800, 1000) },
              { meal: 'Dinner', description: 'Steak, sweet potato, salad', calories_est: randInt(900, 1100) },
            ],
        calories_total: calories,
        protein_grams: protein,
        hydration_liters: isRestDay ? round(rand(2, 3)) : round(rand(3, 4.5)),
        sleep_hours: round(clamp(sleepHours, 3, 10)),
        sleep_quality: sleepQuality,
        bed_time: isPartyNight ? '02:00' : '22:30',
        wake_time: isPartyNight ? '09:00' : '06:00',
        energy_level: energyLevel,
        soreness_level: sorenessLevel,
        stress_level: clamp(randInt(1, 3) + (dayIndex % 7 === 5 ? 1 : 0), 1, 5), // Slightly higher before meets
        alcohol_drinks: isPartyNight ? randInt(3, 8) : 0,
        notes: isRestDay ? 'Rest day' : (isPartyNight ? 'Party night' : null),
      };
    },
  };
}

function createBusyMom(): Persona {
  let sleepDebt = 0;

  return {
    name: 'Busy Mom',
    age: 34,
    gender: 'female',
    description: 'Mom of 2 (ages 3 and 6). Works part-time remote. Fragmented sleep, stress spikes, grabs meals when she can.',
    generate(dayIndex, date) {
      const weekend = isWeekend(date);
      const kidsSick = Math.random() < 0.08; // ~1 day/2 weeks
      const babyWokeUp = Math.random() < 0.4;

      const baseSleep = weekend ? rand(6.5, 8) : rand(5, 7);
      const sleepHours = babyWokeUp ? baseSleep - rand(0.5, 1.5) : baseSleep;
      sleepDebt += (7.5 - sleepHours);
      if (weekend && !kidsSick) sleepDebt = Math.max(0, sleepDebt - 2);

      const stressBase = kidsSick ? 5 : (weekend ? 2 : 3);
      const stressLevel = clamp(Math.round(stressBase + sleepDebt * 0.1), 1, 5);
      const energyLevel = clamp(Math.round(4 - sleepDebt * 0.15 - (kidsSick ? 1 : 0)), 1, 5);

      const didWorkout = !kidsSick && Math.random() < (weekend ? 0.4 : 0.25);
      const mealsLogged = kidsSick ? 1 : (weekend ? 3 : randInt(2, 3));

      const meals: DayLog['meals'] = [];
      if (mealsLogged >= 1) meals.push({ meal: 'Breakfast', description: kidsSick ? 'Coffee only' : 'Yogurt, granola', calories_est: kidsSick ? 50 : randInt(250, 400) });
      if (mealsLogged >= 2) meals.push({ meal: 'Lunch', description: 'Leftovers, salad', calories_est: randInt(400, 600) });
      if (mealsLogged >= 3) meals.push({ meal: 'Dinner', description: 'Family dinner - chicken, veggies', calories_est: randInt(600, 800) });

      const totalCal = meals.reduce((s, m) => s + (m.calories_est || 0), 0) + randInt(100, 400); // snacks

      return {
        meals,
        calories_total: totalCal,
        protein_grams: randInt(50, 90),
        hydration_liters: round(rand(1, 2.2)),
        sleep_hours: round(clamp(sleepHours, 3.5, 9)),
        sleep_quality: clamp(randInt(babyWokeUp ? 1 : 2, babyWokeUp ? 3 : 4), 1, 5),
        bed_time: '23:00',
        wake_time: babyWokeUp ? '05:00' : '06:30',
        energy_level: energyLevel,
        soreness_level: didWorkout ? randInt(2, 3) : 1,
        stress_level: stressLevel,
        alcohol_drinks: !weekend ? 0 : (Math.random() < 0.4 ? randInt(1, 2) : 0),
        notes: kidsSick ? 'Kids sick - rough day' : (didWorkout ? '30min yoga/walk' : null),
      };
    },
  };
}

function createSedentaryWorker(): Persona {
  let weightTrend = 210; // lbs, trending up slowly

  return {
    name: 'Sedentary Office Worker',
    age: 42,
    gender: 'male',
    description: 'Software engineer. 10h at desk, snacks throughout day, poor sleep habits, high stress from deadlines.',
    generate(dayIndex, date) {
      const weekend = isWeekend(date);
      const deadline = dayIndex % 14 < 3; // Deadline pressure every 2 weeks
      const lateNight = !weekend && Math.random() < 0.35;

      const sleepHours = lateNight ? rand(4.5, 5.5) : (weekend ? rand(8, 9.5) : rand(5.5, 7));
      const stressLevel = clamp(Math.round(deadline ? rand(4, 5) : (weekend ? rand(1, 2) : rand(2, 4))), 1, 5);
      const energyLevel = clamp(Math.round(weekend ? 3 : (2 - (lateNight ? 1 : 0) + (sleepHours > 7 ? 1 : 0))), 1, 5);

      weightTrend += rand(-0.1, 0.15); // Slowly gaining

      return {
        meals: [
          { meal: 'Breakfast', description: weekend ? 'Pancakes, bacon' : 'Coffee, bagel', calories_est: weekend ? randInt(600, 800) : randInt(300, 450) },
          { meal: 'Lunch', description: 'Takeout - burger/pizza', calories_est: randInt(800, 1200) },
          { meal: 'Snacks', description: 'Chips, cookies, energy drink', calories_est: randInt(400, 700) },
          { meal: 'Dinner', description: weekend ? 'Restaurant meal' : 'Frozen dinner / delivery', calories_est: randInt(700, 1100) },
        ],
        calories_total: randInt(2500, 3400),
        protein_grams: randInt(60, 100),
        hydration_liters: round(rand(0.8, 1.5)), // Low hydration
        sleep_hours: round(clamp(sleepHours, 4, 10)),
        sleep_quality: clamp(randInt(lateNight ? 1 : 2, lateNight ? 2 : 3), 1, 5),
        bed_time: lateNight ? '01:30' : '23:30',
        wake_time: weekend ? '09:30' : '07:00',
        energy_level: energyLevel,
        soreness_level: 1, // Never sore - never exercises
        stress_level: stressLevel,
        alcohol_drinks: weekend ? randInt(2, 5) : (Math.random() < 0.3 ? randInt(1, 2) : 0),
        notes: deadline ? 'Deadline crunch' : (lateNight ? 'Late night gaming/scrolling' : null),
      };
    },
  };
}

function createWeekendWarrior(): Persona {
  let soreness = 0;

  return {
    name: 'Weekend Warrior',
    age: 38,
    gender: 'male',
    description: 'Account manager. Sedentary weekdays, goes hard on weekends - CrossFit, basketball, hiking. Boom/bust pattern.',
    generate(dayIndex, date) {
      const dow = dayOfWeek(date);
      const weekend = isWeekend(date);
      const isIntenseDay = weekend || dow === 3; // Weekend + occasional Wed

      if (isIntenseDay) {
        soreness = rand(3, 5);
      } else {
        soreness = Math.max(0, soreness - 0.8);
      }

      const sleepHours = gaussRand(weekend ? 8 : 6.5, 0.7);
      const energyLevel = clamp(Math.round(weekend ? 4 : (3 - soreness * 0.3)), 1, 5);

      return {
        meals: weekend
          ? [
              { meal: 'Breakfast', description: 'Big post-workout breakfast', calories_est: randInt(700, 1000) },
              { meal: 'Lunch', description: 'Protein-heavy lunch', calories_est: randInt(600, 900) },
              { meal: 'Dinner', description: 'BBQ / grill night', calories_est: randInt(800, 1200) },
            ]
          : [
              { meal: 'Lunch', description: 'Sandwich from deli', calories_est: randInt(600, 800) },
              { meal: 'Dinner', description: 'Quick dinner at home', calories_est: randInt(600, 900) },
            ],
        calories_total: weekend ? randInt(2800, 3500) : randInt(1800, 2400),
        protein_grams: weekend ? randInt(120, 170) : randInt(70, 100),
        hydration_liters: round(weekend ? rand(2.5, 3.5) : rand(1, 2)),
        sleep_hours: round(clamp(sleepHours, 5, 10)),
        sleep_quality: clamp(randInt(weekend ? 3 : 2, weekend ? 5 : 4), 1, 5),
        bed_time: weekend ? '23:00' : '23:30',
        wake_time: weekend ? '07:30' : '06:45',
        energy_level: energyLevel,
        soreness_level: clamp(Math.round(soreness), 1, 5),
        stress_level: clamp(randInt(weekend ? 1 : 2, weekend ? 2 : 4), 1, 5),
        alcohol_drinks: dow === 5 || dow === 6 ? randInt(2, 5) : 0, // Fri/Sat drinks
        notes: isIntenseDay ? 'Intense workout' : null,
      };
    },
  };
}

function createEnduranceRunner(): Persona {
  let weeklyMileage = 0;
  let cumulativeFatigue = 0;

  return {
    name: 'Endurance Runner',
    age: 29,
    gender: 'female',
    description: 'Marathon runner. Disciplined training, careful nutrition, tracks everything. Periodized training blocks.',
    generate(dayIndex, date) {
      const dow = dayOfWeek(date);
      const weekInBlock = Math.floor(dayIndex / 7) % 4; // 3 build, 1 recovery
      const isRecoveryWeek = weekInBlock === 3;
      const isLongRunDay = dow === 6; // Saturday long run
      const isRestDay = dow === 1; // Monday rest
      const isEasyDay = dow === 3 || dow === 5;

      if (isRestDay) {
        cumulativeFatigue = Math.max(0, cumulativeFatigue - 2);
      } else if (isLongRunDay) {
        cumulativeFatigue += isRecoveryWeek ? 1.5 : 3;
        weeklyMileage += isRecoveryWeek ? 10 : randInt(14, 20);
      } else if (!isEasyDay) {
        cumulativeFatigue += isRecoveryWeek ? 0.5 : 1.5;
        weeklyMileage += isRecoveryWeek ? 4 : randInt(5, 8);
      } else {
        cumulativeFatigue += 0.3;
        weeklyMileage += randInt(3, 5);
      }

      if (dow === 0) weeklyMileage = 0; // Reset weekly

      const sleepHours = gaussRand(8, 0.5); // Prioritizes sleep
      const energyLevel = clamp(Math.round(4 - cumulativeFatigue * 0.2 + (isRestDay ? 1 : 0)), 1, 5);

      return {
        meals: [
          { meal: 'Breakfast', description: 'Oatmeal, berries, coffee', calories_est: randInt(400, 550) },
          { meal: 'Lunch', description: 'Quinoa bowl, greens, salmon', calories_est: randInt(550, 750) },
          { meal: 'Snack', description: 'Banana, almond butter', calories_est: randInt(200, 300) },
          { meal: 'Dinner', description: 'Sweet potato, chicken, veggies', calories_est: randInt(600, 800) },
        ],
        calories_total: isLongRunDay ? randInt(2400, 2800) : randInt(1800, 2200),
        protein_grams: randInt(100, 140),
        hydration_liters: round(isLongRunDay ? rand(3, 4) : rand(2.2, 3)),
        sleep_hours: round(clamp(sleepHours, 6.5, 9.5)),
        sleep_quality: clamp(randInt(3, 5), 1, 5),
        bed_time: '21:30',
        wake_time: '05:30',
        energy_level: energyLevel,
        soreness_level: clamp(Math.round(isLongRunDay ? 3 : (isRestDay ? 1 : 2)), 1, 5),
        stress_level: clamp(randInt(1, 2), 1, 5), // Low stress, running is her outlet
        alcohol_drinks: 0,
        notes: isLongRunDay ? `Long run: ${isRecoveryWeek ? '8' : randInt(12, 18)} miles` : (isRestDay ? 'Active recovery - yoga' : null),
      };
    },
  };
}

function createStressedExec(): Persona {
  let burnoutIndex = 0;

  return {
    name: 'Stressed Executive',
    age: 50,
    gender: 'male',
    description: 'C-suite. 60h weeks, business dinners with alcohol, poor recovery. Tries to exercise but inconsistent.',
    generate(dayIndex, date) {
      const weekend = isWeekend(date);
      const hasDinner = !weekend && Math.random() < 0.4;
      const triedExercise = Math.random() < (weekend ? 0.3 : 0.15);

      burnoutIndex += weekend ? -1 : rand(0.3, 1);
      burnoutIndex = clamp(burnoutIndex, 0, 10);

      const sleepHours = weekend ? rand(7, 9) : rand(4.5, 6.5);
      const stressLevel = clamp(Math.round(3 + burnoutIndex * 0.2), 1, 5);

      return {
        meals: [
          { meal: 'Breakfast', description: 'Coffee, maybe a muffin', calories_est: randInt(100, 350) },
          { meal: 'Lunch', description: 'Business lunch / skipped', calories_est: Math.random() < 0.3 ? 0 : randInt(600, 1000) },
          { meal: 'Dinner', description: hasDinner ? 'Restaurant: steak, wine' : 'Late meal at home', calories_est: randInt(800, 1400) },
        ],
        calories_total: randInt(1800, 3000),
        protein_grams: randInt(60, 110),
        hydration_liters: round(rand(0.5, 1.5)),
        sleep_hours: round(clamp(sleepHours, 3.5, 10)),
        sleep_quality: clamp(randInt(1, weekend ? 4 : 3), 1, 5),
        bed_time: hasDinner ? '00:30' : '23:00',
        wake_time: weekend ? '08:00' : '05:30',
        energy_level: clamp(Math.round(3 - burnoutIndex * 0.15), 1, 5),
        soreness_level: triedExercise ? randInt(2, 4) : 1,
        stress_level: stressLevel,
        alcohol_drinks: hasDinner ? randInt(2, 4) : (weekend ? randInt(1, 3) : (Math.random() < 0.3 ? 1 : 0)),
        notes: hasDinner ? 'Business dinner' : (burnoutIndex > 7 ? 'Exhausted' : null),
      };
    },
  };
}

function createHealthyRetiree(): Persona {
  return {
    name: 'Health-Conscious Retiree',
    age: 65,
    gender: 'female',
    description: 'Retired teacher. Daily walks, yoga 3x/week, consistent meals, good sleep routine. Very consistent patterns.',
    generate(dayIndex, date) {
      const dow = dayOfWeek(date);
      const isYogaDay = dow === 1 || dow === 3 || dow === 5;

      return {
        meals: [
          { meal: 'Breakfast', description: 'Oatmeal, fruit, green tea', calories_est: randInt(300, 400) },
          { meal: 'Lunch', description: 'Soup, salad, whole grain bread', calories_est: randInt(400, 550) },
          { meal: 'Snack', description: 'Nuts, apple', calories_est: randInt(150, 250) },
          { meal: 'Dinner', description: 'Fish, steamed vegetables, rice', calories_est: randInt(450, 600) },
        ],
        calories_total: randInt(1400, 1800),
        protein_grams: randInt(55, 80),
        hydration_liters: round(rand(1.8, 2.5)),
        sleep_hours: round(gaussRand(7.5, 0.3)), // Very consistent
        sleep_quality: clamp(randInt(3, 5), 1, 5),
        bed_time: '21:30',
        wake_time: '06:00',
        energy_level: clamp(randInt(3, 4), 1, 5),
        soreness_level: isYogaDay ? 1 : 1,
        stress_level: clamp(randInt(1, 2), 1, 5),
        alcohol_drinks: dow === 5 ? 1 : 0, // Glass of wine on Fridays
        notes: isYogaDay ? 'Morning yoga + walk' : 'Morning walk 45min',
      };
    },
  };
}

function createNightShiftNurse(): Persona {
  let shiftBlock = 0; // 0-2 = on shift, 3 = off

  return {
    name: 'Night Shift Nurse',
    age: 31,
    gender: 'female',
    description: 'ER nurse. 3 nights on, 1 off rotation. Circadian disruption, meal timing all over, high stress on shift.',
    generate(dayIndex, date) {
      shiftBlock = dayIndex % 4;
      const isOnShift = shiftBlock < 3;
      const isFirstDayOff = shiftBlock === 3;
      const weekend = isWeekend(date);

      // Night shift sleep is fragmented and poor
      const sleepHours = isOnShift ? rand(4, 6) : (isFirstDayOff ? rand(9, 11) : rand(7, 8.5));
      const sleepQuality = isOnShift ? randInt(1, 3) : randInt(3, 5);

      return {
        meals: isOnShift
          ? [
              { meal: 'Pre-shift', description: 'Quick sandwich', calories_est: randInt(300, 500) },
              { meal: 'Break meal', description: 'Cafeteria food, energy bar', calories_est: randInt(400, 700) },
              { meal: 'Post-shift', description: 'Whatever is available', calories_est: randInt(300, 600) },
            ]
          : [
              { meal: 'Brunch', description: 'Eggs, avocado toast', calories_est: randInt(400, 600) },
              { meal: 'Dinner', description: 'Home-cooked meal', calories_est: randInt(500, 800) },
            ],
        calories_total: isOnShift ? randInt(1400, 2000) : randInt(1600, 2200),
        protein_grams: randInt(50, 90),
        hydration_liters: round(isOnShift ? rand(1, 2) : rand(1.5, 2.5)),
        sleep_hours: round(clamp(sleepHours, 3, 12)),
        sleep_quality: sleepQuality,
        bed_time: isOnShift ? '08:00' : '22:00', // Sleeps during day on shift
        wake_time: isOnShift ? '14:00' : '07:00',
        energy_level: clamp(Math.round(isOnShift ? rand(1.5, 3) : (isFirstDayOff ? 2 : rand(3, 4))), 1, 5),
        soreness_level: clamp(randInt(isOnShift ? 2 : 1, isOnShift ? 3 : 2), 1, 5),
        stress_level: clamp(Math.round(isOnShift ? rand(3, 5) : rand(1, 2)), 1, 5),
        alcohol_drinks: !isOnShift && weekend ? randInt(0, 2) : 0,
        notes: isOnShift ? '12h night shift' : (isFirstDayOff ? 'Recovery day - crashed hard' : null),
      };
    },
  };
}

// Your profile - 3 months of varied signals
function createEricProfile(): Persona {
  let trainingLoad = 0;
  let sleepDebt = 0;

  return {
    name: 'Eric (Your Profile)',
    age: 22,
    gender: 'male',
    description: 'College student / founder. Lifts 4-5x/week, decent nutrition, variable sleep. Stress from building Delta.',
    generate(dayIndex, date) {
      const dow = dayOfWeek(date);
      const weekend = isWeekend(date);
      const week = Math.floor(dayIndex / 7);

      // Periodization: some weeks are harder (deadlines, exams, launches)
      const isHardWeek = week % 4 === 2 || week % 4 === 3;
      const isLiftDay = [1, 2, 3, 4, 5].includes(dow) && Math.random() < (isHardWeek ? 0.6 : 0.85);
      const lateNightCoding = !weekend && Math.random() < (isHardWeek ? 0.5 : 0.2);
      const socialNight = weekend && Math.random() < 0.35;

      if (isLiftDay) {
        trainingLoad += rand(2, 4);
      } else {
        trainingLoad = Math.max(0, trainingLoad - 1.5);
      }

      const baseSleep = lateNightCoding ? rand(4.5, 6) : (socialNight ? rand(5, 6.5) : rand(6.5, 8.5));
      sleepDebt += (7.5 - baseSleep);
      if (weekend && !socialNight) sleepDebt = Math.max(0, sleepDebt - 2);

      const energyBase = 4;
      const energyLevel = clamp(Math.round(
        energyBase
        - sleepDebt * 0.08
        - trainingLoad * 0.08
        + (baseSleep > 7.5 ? 0.5 : 0)
        - (isHardWeek ? 0.5 : 0)
      ), 1, 5);

      const stressLevel = clamp(Math.round(
        (isHardWeek ? 4 : 2)
        + (lateNightCoding ? 1 : 0)
        - (weekend ? 1 : 0)
      ), 1, 5);

      // Create intentional cause-effect patterns:
      // 1. Sleep < 6h -> energy drops next day
      // 2. High stress -> poor sleep quality
      // 3. Alcohol -> bad sleep -> bad energy
      // 4. Consistent lifting -> soreness but better energy baseline
      // 5. Hydration correlates with energy

      const hydration = round(isLiftDay ? rand(2.5, 3.5) : rand(1.5, 2.5));

      return {
        meals: [
          { meal: 'Breakfast', description: isLiftDay ? 'Protein shake, eggs, oats' : 'Coffee, light breakfast', calories_est: isLiftDay ? randInt(600, 800) : randInt(300, 500) },
          { meal: 'Lunch', description: 'Chipotle bowl / dining hall', calories_est: randInt(700, 1000) },
          ...(isLiftDay ? [{ meal: 'Post-Workout', description: 'Protein shake, fruit', calories_est: randInt(300, 400) }] : []),
          { meal: 'Dinner', description: weekend ? 'Going out / ordering in' : 'Chicken, rice, veggies', calories_est: randInt(600, 1000) },
        ],
        calories_total: isLiftDay ? randInt(2600, 3200) : randInt(2000, 2600),
        protein_grams: isLiftDay ? randInt(150, 200) : randInt(100, 140),
        hydration_liters: hydration,
        sleep_hours: round(clamp(baseSleep, 3.5, 10)),
        sleep_quality: clamp(Math.round(
          (baseSleep > 7 ? 4 : 3)
          - (socialNight ? 1.5 : 0)
          - (stressLevel > 3 ? 1 : 0)
          - (lateNightCoding ? 0.5 : 0)
        ), 1, 5),
        bed_time: lateNightCoding ? '02:00' : (socialNight ? '01:30' : '23:30'),
        wake_time: weekend ? '09:00' : '07:30',
        energy_level: energyLevel,
        soreness_level: clamp(Math.round(trainingLoad * 0.25), 1, 5),
        stress_level: stressLevel,
        alcohol_drinks: socialNight ? randInt(2, 6) : 0,
        notes: isLiftDay
          ? ['Push day', 'Pull day', 'Legs', 'Upper body', 'Full body'][dow % 5]
          : (lateNightCoding ? 'Late night coding Delta' : null),
      };
    },
  };
}

function round(n: number, decimals: number = 1): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// ============================================================
// SIMULATION RUNNER
// ============================================================

async function simulatePersona(userId: string, persona: Persona, days: number) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${persona.name} (${persona.age}/${persona.gender})`);
  console.log(`  ${persona.description}`);
  console.log(`  User: ${userId} | ${days} days: ${formatDate(startDate)} → ${formatDate(endDate)}`);
  console.log('='.repeat(60));

  let logged = 0;
  let failed = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);
    const dayLog = persona.generate(i, date);

    try {
      await apiPut(`/calendar/${userId}/${dateStr}`, dayLog);
      logged++;
      if (logged % 10 === 0 || logged === days) {
        process.stdout.write(`\r  Logged ${logged}/${days} days`);
      }
    } catch (err: any) {
      failed++;
      if (failed <= 3) {
        console.error(`\n  [!] Day ${dateStr}: ${err.message}`);
      }
    }

    // Small delay to avoid rate limiting
    if (i % 5 === 0) await sleep(100);
  }

  console.log(`\n  Done: ${logged} logged, ${failed} failed`);
  return { logged, failed };
}

async function fetchIntelligenceResults(userId: string, personaName: string) {
  console.log(`\n  Fetching intelligence results for ${personaName}...`);

  const results: Record<string, unknown> = {};

  const endpoints = [
    { key: 'state', path: `/health-intelligence/${userId}/state` },
    { key: 'causalChains', path: `/health-intelligence/${userId}/causal-chains?days=90` },
    { key: 'baselines', path: `/health-intelligence/${userId}/baselines` },
    { key: 'narrative', path: `/health-intelligence/${userId}/narrative/weekly` },
    { key: 'learnedChains', path: `/health-intelligence/${userId}/learned-chains` },
    { key: 'predictions', path: `/health-intelligence/${userId}/predictions` },
    { key: 'beliefUpdates', path: `/health-intelligence/${userId}/belief-updates` },
    { key: 'uncertainty', path: `/health-intelligence/${userId}/uncertainty` },
    { key: 'learningStatus', path: `/health-intelligence/${userId}/learning-status` },
  ];

  for (const ep of endpoints) {
    try {
      results[ep.key] = await apiGet(ep.path);
      console.log(`    ✓ ${ep.key}`);
    } catch (err: any) {
      console.log(`    ✗ ${ep.key}: ${err.message.slice(0, 80)}`);
      results[ep.key] = null;
    }
  }

  return results;
}

function printAnalysis(personaName: string, results: Record<string, unknown>) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ANALYSIS: ${personaName}`);
  console.log('─'.repeat(60));

  // Health State
  const state = results.state as any;
  if (state?.has_data) {
    console.log(`\n  Recovery: ${state.recovery?.state || '?'} (${Math.round((state.recovery?.confidence || 0) * 100)}%)`);
    console.log(`  Load:     ${state.load?.state || '?'} (cumulative: ${state.load?.cumulative || 0})`);
    console.log(`  Energy:   ${state.energy?.state || '?'}`);
    if (state.alignment) {
      console.log(`  Chronotype: ${state.alignment.chronotype} (${Math.round(state.alignment.chronotype_confidence * 100)}%)`);
    }
    if (state.readiness) {
      console.log(`  Readiness: ${state.readiness.score}/100 → ${state.readiness.recommendation}`);
    }
  } else {
    console.log(`\n  No health state data yet`);
  }

  // Causal Chains
  const chains = results.causalChains as any;
  if (chains?.chains?.length > 0) {
    console.log(`\n  Causal Chains (${chains.chains.length} discovered, ${chains.days_analyzed} days):`);
    chains.chains.slice(0, 5).forEach((c: any) => {
      console.log(`    ${c.cause_event} → ${c.effect_event} | ${Math.round(c.confidence * 100)}% conf | +${c.lag_days}d lag | ${c.occurrences}x`);
    });
  }

  // Learned Chains
  const learned = results.learnedChains as any;
  if (learned?.chains?.length > 0) {
    console.log(`\n  Learned Chains (${learned.count}):`);
    learned.chains.slice(0, 5).forEach((c: any) => {
      console.log(`    ${c.cause} → ${c.effect} | ${Math.round(c.confidence * 100)}% | verified ${c.times_verified}/${c.total_occurrences}x`);
    });
  }

  // Predictions
  const preds = results.predictions as any;
  if (preds?.predictions?.length > 0) {
    console.log(`\n  Active Predictions (${preds.predictions.length}):`);
    if (preds.accuracy) {
      console.log(`    Accuracy: ${preds.accuracy.correct}/${preds.accuracy.total}`);
    }
    preds.predictions.slice(0, 3).forEach((p: any) => {
      console.log(`    ${p.metric}: ${p.predicted_direction} (${Math.round(p.confidence * 100)}%) - ${p.reasoning.slice(0, 60)}`);
    });
  }

  // Belief Updates
  const beliefs = results.beliefUpdates as any;
  if (beliefs?.updates?.length > 0) {
    console.log(`\n  Recent Belief Updates (${beliefs.updates.length}):`);
    beliefs.updates.slice(0, 3).forEach((b: any) => {
      const arrow = b.new_confidence > b.old_confidence ? '↑' : '↓';
      console.log(`    ${arrow} ${b.pattern}: ${Math.round(b.old_confidence * 100)}% → ${Math.round(b.new_confidence * 100)}% | ${b.reason.slice(0, 50)}`);
    });
  }

  // Knowledge Gaps
  const gaps = results.uncertainty as any;
  if (gaps?.gaps?.length > 0) {
    console.log(`\n  Knowledge Gaps (overall confidence: ${Math.round(gaps.overall_confidence * 100)}%):`);
    gaps.gaps.slice(0, 3).forEach((g: any) => {
      console.log(`    • ${g.description} (need ${g.days_needed} more days)`);
    });
  }

  // Learning Status
  const status = results.learningStatus as any;
  if (status) {
    console.log(`\n  Learning Status: ${status.status}`);
    console.log(`    ${status.days_of_data} days | ${status.patterns_discovered} patterns | ${status.predictions_correct}/${status.predictions_made} predictions correct`);
  }

  // Narrative
  const narrative = results.narrative as any;
  if (narrative?.narrative) {
    console.log(`\n  Weekly Narrative:`);
    console.log(`    "${narrative.narrative.slice(0, 200)}..."`);
  }

  console.log('');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const runProfile = args.includes('--profile') || args.includes('--all');
  const runPersonas = args.includes('--personas') || args.includes('--all');

  if (!runProfile && !runPersonas) {
    console.log('Usage:');
    console.log('  npx ts-node scripts/simulate.ts --profile    # Your profile, 90 days');
    console.log('  npx ts-node scripts/simulate.ts --personas   # 8 persona simulations');
    console.log('  npx ts-node scripts/simulate.ts --all        # Both');
    process.exit(0);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       DELTA HEALTH INTELLIGENCE SIMULATOR               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Warm up the server
  console.log('\nWarming up server...');
  try {
    await fetch(`${BASE_URL}/health`);
    console.log('Server is ready.');
  } catch {
    console.log('Server may be cold-starting, continuing anyway...');
  }

  const allResults: Array<{ persona: string; userId: string; results: Record<string, unknown> }> = [];

  // ===== YOUR PROFILE =====
  if (runProfile) {
    // Use --user-id <id> to simulate on your real account, otherwise uses sim ID
    const userIdIndex = args.indexOf('--user-id');
    const ericUserId = (userIdIndex >= 0 && args[userIdIndex + 1]) ? args[userIdIndex + 1] : 'sim-eric-profile';
    console.log(`\n  Using user ID: ${ericUserId}`);
    const eric = createEricProfile();
    await simulatePersona(ericUserId, eric, 90);

    // Send natural language chat messages to test extraction pipeline
    console.log('\n  Sending natural language chat messages...');
    const chatMessages = [
      "Had a rough night, kept waking up around 3am",
      "Feeling pretty stressed about deadlines at work",
      "My skin has been breaking out, not sure why",
      "Had a massive burrito for lunch, probably too much",
      "Went for a nice walk in the park, felt great after",
      "Drank way too much coffee today, 4 cups",
      "Got in a fight with my girlfriend, feeling down",
      "Hit a PR on bench press today, 185 lbs!",
      "Skipped breakfast, just had coffee",
      "Feeling really sore from yesterday's leg day",
      "Slept 9 hours last night and feel amazing",
      "Had salmon and veggies for dinner, trying to eat cleaner",
    ];
    let chatSent = 0;
    for (const msg of chatMessages) {
      try {
        await apiPost('/chat', {
          user_id: ericUserId,
          message: msg,
          unit_system: 'imperial',
        });
        chatSent++;
      } catch {
        // Chat endpoint may not be available
      }
      await sleep(500);
    }
    console.log(`  Sent ${chatSent}/${chatMessages.length} chat messages`);

    await sleep(2000); // Let the backend process

    const results = await fetchIntelligenceResults(ericUserId, eric.name);
    printAnalysis(eric.name, results);
    allResults.push({ persona: eric.name, userId: ericUserId, results });
  }

  // ===== PERSONA SIMULATIONS =====
  if (runPersonas) {
    const personas: Array<{ id: string; create: () => Persona }> = [
      { id: 'sim-college-athlete', create: createCollegeAthlete },
      { id: 'sim-busy-mom', create: createBusyMom },
      { id: 'sim-sedentary-worker', create: createSedentaryWorker },
      { id: 'sim-weekend-warrior', create: createWeekendWarrior },
      { id: 'sim-endurance-runner', create: createEnduranceRunner },
      { id: 'sim-stressed-exec', create: createStressedExec },
      { id: 'sim-healthy-retiree', create: createHealthyRetiree },
      { id: 'sim-night-nurse', create: createNightShiftNurse },
    ];

    for (const p of personas) {
      const persona = p.create();
      await simulatePersona(p.id, persona, 90);
      await sleep(2000);

      const results = await fetchIntelligenceResults(p.id, persona.name);
      printAnalysis(persona.name, results);
      allResults.push({ persona: persona.name, userId: p.id, results });
    }
  }

  // ===== SUMMARY =====
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    SIMULATION SUMMARY                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const r of allResults) {
    const state = r.results.state as any;
    const chains = r.results.causalChains as any;
    const status = r.results.learningStatus as any;
    const preds = r.results.predictions as any;

    console.log(`  ${r.persona.padEnd(30)} | ` +
      `Recovery: ${(state?.recovery?.state || 'n/a').padEnd(15)} | ` +
      `Chains: ${(chains?.chains?.length || 0).toString().padStart(2)} | ` +
      `Predictions: ${preds?.accuracy ? `${preds.accuracy.correct}/${preds.accuracy.total}` : 'n/a'} | ` +
      `Status: ${status?.status || 'n/a'}`
    );
  }

  console.log('\nDone. View results in the app under the "You" tab.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
