/**
 * Nutrition service — local-first, AsyncStorage-backed.
 * Handles feeding logs, daily calorie tracking, goals, and weekly reports.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  DailyNutritionSummary,
  FoodItem,
  NutritionGoal,
  NutritionLog,
  WeeklyNutritionReport,
} from '../models/NutritionLog';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const NUTRITION_LOGS_KEY = '@nutrition_logs';
const NUTRITION_GOALS_KEY = '@nutrition_goals';

// ─── CRUD: Nutrition Logs ─────────────────────────────────────────────────────

export async function getNutritionLogs(): Promise<NutritionLog[]> {
  const raw = await AsyncStorage.getItem(NUTRITION_LOGS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getNutritionLogsByPet(petId: string): Promise<NutritionLog[]> {
  const logs = await getNutritionLogs();
  return logs.filter((l) => l.petId === petId);
}

export async function getNutritionLogsByDate(petId: string, date: string): Promise<NutritionLog[]> {
  const logs = await getNutritionLogs();
  return logs.filter((l) => l.petId === petId && l.date === date);
}

export async function saveNutritionLog(log: NutritionLog): Promise<void> {
  const logs = await getNutritionLogs();
  const idx = logs.findIndex((l) => l.id === log.id);
  if (idx >= 0) {
    logs[idx] = { ...log, updatedAt: new Date().toISOString() };
  } else {
    logs.push(log);
  }
  await AsyncStorage.setItem(NUTRITION_LOGS_KEY, JSON.stringify(logs));
}

export async function deleteNutritionLog(id: string): Promise<void> {
  const logs = await getNutritionLogs();
  await AsyncStorage.setItem(NUTRITION_LOGS_KEY, JSON.stringify(logs.filter((l) => l.id !== id)));
}

// ─── CRUD: Nutrition Goals ────────────────────────────────────────────────────

export async function getNutritionGoals(): Promise<NutritionGoal[]> {
  const raw = await AsyncStorage.getItem(NUTRITION_GOALS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getNutritionGoalByPet(petId: string): Promise<NutritionGoal | null> {
  const goals = await getNutritionGoals();
  return goals.find((g) => g.petId === petId) ?? null;
}

export async function saveNutritionGoal(goal: NutritionGoal): Promise<void> {
  const goals = await getNutritionGoals();
  const idx = goals.findIndex((g) => g.petId === goal.petId);
  const updated = { ...goal, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    goals[idx] = updated;
  } else {
    goals.push(updated);
  }
  await AsyncStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(goals));
}

// ─── Calorie Calculations ─────────────────────────────────────────────────────

/**
 * Sum calories for a list of logs.
 */
export function sumCalories(logs: NutritionLog[]): number {
  return logs.reduce((total, l) => total + (l.calories ?? 0), 0);
}

/**
 * Sum a macro nutrient (protein, fat, carbs) across logs.
 */
export function sumMacro(logs: NutritionLog[], macro: 'protein' | 'fat' | 'carbs'): number {
  return logs.reduce((total, l) => total + (l[macro] ?? 0), 0);
}

/**
 * Determine feeding status relative to daily goal.
 * Under: < 90% of goal. Over: > 110% of goal. On track: within ±10%.
 */
export function getFeedingStatus(
  totalCalories: number,
  goalCalories: number,
): 'under' | 'on_track' | 'over' {
  if (goalCalories <= 0) return 'on_track';
  const ratio = totalCalories / goalCalories;
  if (ratio < 0.9) return 'under';
  if (ratio > 1.1) return 'over';
  return 'on_track';
}

/**
 * Build a daily nutrition summary for a pet on a given date.
 */
export async function getDailySummary(petId: string, date: string): Promise<DailyNutritionSummary> {
  const [logs, goal] = await Promise.all([
    getNutritionLogsByDate(petId, date),
    getNutritionGoalByPet(petId),
  ]);

  const totalCalories = sumCalories(logs);
  const totalProteinG = sumMacro(logs, 'protein');
  const totalFatG = sumMacro(logs, 'fat');
  const totalCarbsG = sumMacro(logs, 'carbs');
  const status = getFeedingStatus(totalCalories, goal?.dailyCalories ?? 0);

  return {
    date,
    petId,
    totalCalories,
    totalProteinG,
    totalFatG,
    totalCarbsG,
    mealCount: logs.length,
    logs,
    goal: goal ?? undefined,
    status,
  };
}

/**
 * Generate a weekly nutrition report for a pet.
 * weekStart should be a Monday in YYYY-MM-DD format.
 */
export async function getWeeklyReport(
  petId: string,
  weekStart: string,
): Promise<WeeklyNutritionReport> {
  const start = new Date(weekStart);
  const dailySummaries: DailyNutritionSummary[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const summary = await getDailySummary(petId, dateStr);
    dailySummaries.push(summary);
  }

  const weekEnd = new Date(start);
  weekEnd.setDate(start.getDate() + 6);

  const daysWithLogs = dailySummaries.filter((s) => s.mealCount > 0);
  const totalDays = daysWithLogs.length || 1; // avoid division by zero

  const avgDailyCalories = daysWithLogs.reduce((s, d) => s + d.totalCalories, 0) / totalDays;
  const avgDailyProteinG = daysWithLogs.reduce((s, d) => s + d.totalProteinG, 0) / totalDays;
  const avgDailyFatG = daysWithLogs.reduce((s, d) => s + d.totalFatG, 0) / totalDays;
  const avgDailyCarbsG = daysWithLogs.reduce((s, d) => s + d.totalCarbsG, 0) / totalDays;

  const daysOnTrack = dailySummaries.filter((s) => s.status === 'on_track').length;
  const daysUnder = dailySummaries.filter((s) => s.status === 'under').length;
  const daysOver = dailySummaries.filter((s) => s.status === 'over').length;

  const recommendation = buildWeeklyRecommendation(
    daysOnTrack,
    daysUnder,
    daysOver,
    avgDailyCalories,
  );

  return {
    petId,
    weekStart,
    weekEnd: weekEnd.toISOString().slice(0, 10),
    dailySummaries,
    avgDailyCalories: Math.round(avgDailyCalories),
    avgDailyProteinG: Math.round(avgDailyProteinG * 10) / 10,
    avgDailyFatG: Math.round(avgDailyFatG * 10) / 10,
    avgDailyCarbsG: Math.round(avgDailyCarbsG * 10) / 10,
    daysOnTrack,
    daysUnder,
    daysOver,
    recommendation,
  };
}

function buildWeeklyRecommendation(
  daysOnTrack: number,
  daysUnder: number,
  daysOver: number,
  avgCalories: number,
): string {
  if (daysOnTrack >= 5) {
    return "Great job! Your pet's nutrition is well-balanced this week.";
  }
  if (daysOver >= 4) {
    return `Your pet was overfed on ${daysOver} days this week. Consider reducing portion sizes to avoid weight gain.`;
  }
  if (daysUnder >= 4) {
    return `Your pet was underfed on ${daysUnder} days this week. Ensure consistent daily feeding to meet nutritional needs.`;
  }
  if (daysOver > daysUnder) {
    return 'Feeding was slightly above target on most days. Monitor portions to stay on track.';
  }
  if (daysUnder > daysOver) {
    return 'Feeding was slightly below target on most days. Try to maintain consistent meal times.';
  }
  return `Average daily intake was ${Math.round(avgCalories)} kcal. Keep monitoring to stay consistent.`;
}

// ─── Dietary Recommendations ──────────────────────────────────────────────────

/**
 * Calculate recommended daily calories based on pet weight, species, and activity level.
 * Uses Resting Energy Requirement (RER) formula: 70 × (weight_kg ^ 0.75)
 * Then applies a multiplier based on activity level.
 */
export function calculateRecommendedCalories(
  weightKg: number,
  species: string,
  activityLevel: 'low' | 'moderate' | 'high',
  healthConditions: string[] = [],
): number {
  if (weightKg <= 0) return 0;

  // RER = 70 × (weight_kg ^ 0.75)
  const rer = 70 * Math.pow(weightKg, 0.75);

  // Activity multipliers
  const activityMultipliers: Record<string, number> = {
    low: 1.2,
    moderate: 1.6,
    high: 2.0,
  };
  let multiplier = activityMultipliers[activityLevel] ?? 1.6;

  // Species adjustment (cats have slightly different metabolism)
  if (species === 'cat') {
    multiplier *= 0.9;
  }

  // Health condition adjustments
  if (healthConditions.includes('obesity')) multiplier *= 0.8;
  if (healthConditions.includes('diabetes')) multiplier *= 0.85;
  if (healthConditions.includes('kidney_disease')) multiplier *= 0.9;
  if (healthConditions.includes('hyperthyroidism')) multiplier *= 1.1;

  return Math.round(rer * multiplier);
}

/**
 * Get dietary recommendations based on breed and health conditions.
 */
export function getDietaryRecommendations(
  species: string,
  breed: string,
  healthConditions: string[],
): string[] {
  const tips: string[] = [];

  // Species-specific
  if (species === 'dog') {
    tips.push('Dogs need a balanced diet with protein, fats, and carbohydrates.');
    if (breed.toLowerCase().includes('labrador') || breed.toLowerCase().includes('retriever')) {
      tips.push('Labradors are prone to obesity — monitor calorie intake carefully.');
    }
    if (breed.toLowerCase().includes('bulldog')) {
      tips.push('Bulldogs can have sensitive stomachs — avoid sudden diet changes.');
    }
    if (breed.toLowerCase().includes('husky') || breed.toLowerCase().includes('malamute')) {
      tips.push('High-energy breeds need calorie-dense food, especially in cold weather.');
    }
  } else if (species === 'cat') {
    tips.push('Cats are obligate carnivores — ensure high protein content in their diet.');
    tips.push('Cats need taurine from animal sources for heart and eye health.');
    if (breed.toLowerCase().includes('persian') || breed.toLowerCase().includes('maine coon')) {
      tips.push('Large/long-haired breeds may benefit from hairball-control formulas.');
    }
  }

  // Health condition-specific
  if (healthConditions.includes('obesity')) {
    tips.push('Reduce calorie intake by 20% and increase exercise. Use weight-management food.');
  }
  if (healthConditions.includes('diabetes')) {
    tips.push(
      'Feed consistent portions at regular times. Low-glycemic, high-fiber diets help regulate blood sugar.',
    );
  }
  if (healthConditions.includes('kidney_disease')) {
    tips.push(
      'Low-phosphorus, low-protein diets are recommended for kidney disease. Consult your vet.',
    );
  }
  if (healthConditions.includes('allergies')) {
    tips.push('Consider a limited-ingredient or hydrolyzed protein diet to identify allergens.');
  }
  if (healthConditions.includes('arthritis')) {
    tips.push('Omega-3 fatty acids (fish oil) can help reduce joint inflammation.');
  }
  if (healthConditions.includes('heart_disease')) {
    tips.push('Low-sodium diets are important for pets with heart conditions.');
  }

  if (tips.length === 0) {
    tips.push("Maintain a balanced diet appropriate for your pet's age and size.");
  }

  return tips;
}

// ─── Mock Pet Food Database ───────────────────────────────────────────────────

/**
 * Mock nutrition database — simulates an external API response.
 * In production, replace with a real API call via apiClient.
 */
export async function searchFoodDatabase(query: string): Promise<FoodItem[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const db: FoodItem[] = [
    {
      id: 'food_001',
      name: 'Royal Canin Adult',
      brand: 'Royal Canin',
      category: 'dry',
      caloriesPer100g: 358,
      proteinPer100g: 25,
      fatPer100g: 14,
      carbsPer100g: 33,
      fiberPer100g: 3.4,
      suitableFor: ['dog'],
    },
    {
      id: 'food_002',
      name: "Hill's Science Diet Adult",
      brand: "Hill's",
      category: 'dry',
      caloriesPer100g: 363,
      proteinPer100g: 18.5,
      fatPer100g: 12.5,
      carbsPer100g: 44,
      fiberPer100g: 2.8,
      suitableFor: ['dog'],
    },
    {
      id: 'food_003',
      name: 'Purina Pro Plan Adult',
      brand: 'Purina',
      category: 'dry',
      caloriesPer100g: 375,
      proteinPer100g: 30,
      fatPer100g: 17,
      carbsPer100g: 30,
      fiberPer100g: 3,
      suitableFor: ['dog'],
    },
    {
      id: 'food_004',
      name: 'Royal Canin Cat Adult',
      brand: 'Royal Canin',
      category: 'dry',
      caloriesPer100g: 340,
      proteinPer100g: 32,
      fatPer100g: 12,
      carbsPer100g: 30,
      fiberPer100g: 5.8,
      suitableFor: ['cat'],
    },
    {
      id: 'food_005',
      name: 'Whiskas Adult Wet Food',
      brand: 'Whiskas',
      category: 'wet',
      caloriesPer100g: 85,
      proteinPer100g: 8,
      fatPer100g: 5,
      carbsPer100g: 3,
      fiberPer100g: 0.5,
      suitableFor: ['cat'],
    },
    {
      id: 'food_006',
      name: 'Pedigree Adult Wet Food',
      brand: 'Pedigree',
      category: 'wet',
      caloriesPer100g: 78,
      proteinPer100g: 7,
      fatPer100g: 4.5,
      carbsPer100g: 4,
      fiberPer100g: 0.8,
      suitableFor: ['dog'],
    },
    {
      id: 'food_007',
      name: 'Milk-Bone Dog Biscuits',
      brand: 'Milk-Bone',
      category: 'treat',
      caloriesPer100g: 380,
      proteinPer100g: 10,
      fatPer100g: 8,
      carbsPer100g: 65,
      fiberPer100g: 2,
      suitableFor: ['dog'],
    },
    {
      id: 'food_008',
      name: 'Temptations Cat Treats',
      brand: 'Temptations',
      category: 'treat',
      caloriesPer100g: 320,
      proteinPer100g: 28,
      fatPer100g: 10,
      carbsPer100g: 40,
      fiberPer100g: 1,
      suitableFor: ['cat'],
    },
    {
      id: 'food_009',
      name: 'Blue Buffalo Life Protection',
      brand: 'Blue Buffalo',
      category: 'dry',
      caloriesPer100g: 370,
      proteinPer100g: 26,
      fatPer100g: 15,
      carbsPer100g: 35,
      fiberPer100g: 4,
      suitableFor: ['dog'],
    },
    {
      id: 'food_010',
      name: 'Iams Proactive Health',
      brand: 'Iams',
      category: 'dry',
      caloriesPer100g: 355,
      proteinPer100g: 22,
      fatPer100g: 13,
      carbsPer100g: 38,
      fiberPer100g: 3,
      suitableFor: ['dog', 'cat'],
    },
  ];

  const q = query.toLowerCase().trim();
  if (!q) return db;

  return db.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      (item.brand?.toLowerCase().includes(q) ?? false) ||
      item.category.toLowerCase().includes(q),
  );
}

/**
 * Calculate calories for a given food item and amount.
 */
export function calculateCaloriesFromFood(food: FoodItem, amount: number, unit: string): number {
  // Convert everything to grams first
  let amountInGrams = amount;
  switch (unit) {
    case 'kg':
      amountInGrams = amount * 1000;
      break;
    case 'oz':
      amountInGrams = amount * 28.35;
      break;
    case 'cup':
      amountInGrams = amount * 120; // approximate for dry kibble
      break;
    case 'ml':
      amountInGrams = amount; // approximate 1ml ≈ 1g for wet food
      break;
    default:
      amountInGrams = amount; // grams
  }

  return Math.round((food.caloriesPer100g * amountInGrams) / 100);
}
