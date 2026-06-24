/**
 * Nutrition service for meal logging, calorie calculation, and dietary analysis
 */

import { setItem, getItem } from './localDB';
import { syncService } from './syncService';
import errorLogger from '../utils/errorLogger';
import type { Pet } from '../models/Pet';
import type {
  MealLog,
  NutritionalGap,
  BreedRecommendation,
  ActivityLevel,
  Species,
  NutritionalTarget,
  BreedNotFoundError,
} from '../models/Nutrition';
import {
  CALORIE_BASE_BY_SPECIES,
  ACTIVITY_MULTIPLIER,
  NEUTERED_MULTIPLIER,
  BREED_CALORIE_ADJUSTMENTS,
  BREED_NUTRITIONAL_TARGETS,
  BreedNotFoundError as BreedNotFoundErrorClass,
} from '../models/Nutrition';

// ───────────────────────────────────────────────────────────────────────────────
// MEAL LOGGING
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Log a meal for a pet. Persists to local DB and queues for sync.
 * Returns immediately with the meal log entry.
 *
 * @throws Error if meal cannot be persisted
 */
export async function logMeal(meal: Omit<MealLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<MealLog> {
  try {
    const now = new Date().toISOString();
    const mealLog: MealLog = {
      ...meal,
      id: `meal_${meal.petId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: now,
      updatedAt: now,
      synced: false,
    };

    // Persist to local DB
    const mealKey = `@meal_${mealLog.id}`;
    await setItem(mealKey, JSON.stringify(mealLog));

    // Queue for sync
    await syncService.enqueue('mealLog', 'create', mealLog);

    return mealLog;
  } catch (err) {
    await errorLogger.logError(err, {
      context: 'nutritionService.logMeal',
      petId: meal.petId,
    });
    throw err;
  }
}

/**
 * Retrieve all meal logs for a pet
 */
export async function getMealLogs(petId: string): Promise<MealLog[]> {
  try {
    const logsKey = `@meal_logs_${petId}`;
    const stored = await getItem(logsKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    // Return empty array if no logs exist
    return [];
  }
}

/**
 * Update an existing meal log
 */
export async function updateMeal(mealId: string, updates: Partial<MealLog>): Promise<MealLog> {
  try {
    const mealKey = `@meal_${mealId}`;
    const stored = await getItem(mealKey);

    if (!stored) {
      throw new Error(`Meal with ID "${mealId}" not found`);
    }

    const meal: MealLog = JSON.parse(stored);
    const updated: MealLog = {
      ...meal,
      ...updates,
      id: meal.id,
      petId: meal.petId,
      createdAt: meal.createdAt,
      updatedAt: new Date().toISOString(),
      synced: false,
    };

    await setItem(mealKey, JSON.stringify(updated));
    await syncService.enqueue('mealLog', 'update', updated);

    return updated;
  } catch (err) {
    await errorLogger.logError(err, {
      context: 'nutritionService.updateMeal',
      mealId,
    });
    throw err;
  }
}

/**
 * Delete a meal log
 */
export async function deleteMeal(mealId: string): Promise<void> {
  try {
    const mealKey = `@meal_${mealId}`;
    await syncService.enqueue('mealLog', 'delete', { id: mealId });
  } catch (err) {
    await errorLogger.logError(err, {
      context: 'nutritionService.deleteMeal',
      mealId,
    });
    throw err;
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// CALORIE CALCULATION
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Calculate daily calorie requirement for a pet
 *
 * Formula: Base × Weight × Activity Factor × Breed Factor × Neutered Multiplier
 *
 * @param weight - Weight in kg
 * @param activityLevel - 'low' | 'moderate' | 'high'
 * @param species - Pet species
 * @param neutered - Whether the pet is neutered/spayed
 * @param breedId - Optional breed ID for breed-specific adjustments
 * @returns Daily calorie requirement in kcal
 * @throws Error if inputs are invalid
 */
export function calculateDailyCalories(
  weight: number,
  activityLevel: ActivityLevel = 'moderate',
  species: Species = 'dog',
  neutered: boolean = false,
  breedId?: string,
): number {
  // Validate inputs
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('Weight must be a positive number');
  }

  if (!ACTIVITY_MULTIPLIER[activityLevel]) {
    throw new Error(`Invalid activity level: ${activityLevel}`);
  }

  if (!CALORIE_BASE_BY_SPECIES[species]) {
    throw new Error(`Invalid species: ${species}`);
  }

  // Base calculation
  const base = CALORIE_BASE_BY_SPECIES[species];
  const activityFactor = ACTIVITY_MULTIPLIER[activityLevel];
  const neuteredFactor = neutered ? NEUTERED_MULTIPLIER : 1;

  let calories = base * weight * activityFactor * neuteredFactor;

  // Apply breed adjustment if provided
  if (breedId && BREED_CALORIE_ADJUSTMENTS[breedId]) {
    calories *= BREED_CALORIE_ADJUSTMENTS[breedId];
  }

  // Round to nearest integer
  return Math.round(calories);
}

// ───────────────────────────────────────────────────────────────────────────────
// NUTRITIONAL GAP ANALYSIS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Analyze nutritional gaps between meal logs and target nutrients
 *
 * @param mealLog - Array of meal logs (e.g., for a day)
 * @param targetNutrients - Target nutritional values
 * @returns Array of nutritional gaps showing deficiencies and excesses
 */
export function analyzeNutritionalGaps(
  mealLog: MealLog[],
  targetNutrients: NutritionalTarget,
): NutritionalGap[] {
  // Aggregate nutrients from all meals
  const actualNutrients = {
    protein: 0,
    fat: 0,
    fiber: 0,
    calcium: 0,
    phosphorus: 0,
  };

  mealLog.forEach((meal) => {
    actualNutrients.protein += meal.protein || 0;
    actualNutrients.fat += meal.fat || 0;
    actualNutrients.fiber += meal.fiber || 0;
    actualNutrients.calcium += meal.calcium || 0;
    actualNutrients.phosphorus += meal.phosphorus || 0;
  });

  // Analyze each nutrient
  const gaps: NutritionalGap[] = [];

  Object.entries(actualNutrients).forEach(([nutrient, actual]) => {
    const target = targetNutrients[nutrient as keyof NutritionalTarget] || 0;
    const gap = actual - target;

    // Classify gap status
    let status: 'deficient' | 'adequate' | 'excess';
    if (gap < -0.5) {
      // Allow 0.5g tolerance
      status = 'deficient';
    } else if (gap > 0.5) {
      status = 'excess';
    } else {
      status = 'adequate';
    }

    gaps.push({
      nutrient,
      target,
      actual,
      gap,
      status,
    });
  });

  return gaps;
}

// ───────────────────────────────────────────────────────────────────────────────
// BREED RECOMMENDATIONS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Get breed-specific nutritional recommendations
 *
 * @param breedId - The breed identifier
 * @param petData - Optional pet data for additional context (weight, neutered status)
 * @returns Breed recommendation including calorie and nutrient targets
 * @throws BreedNotFoundError if breed not found
 */
export function getBreedRecommendations(
  breedId: string,
  petData?: { weight?: number; species?: Species; neutered?: boolean },
): BreedRecommendation {
  // Validate breed exists
  if (!breedId || typeof breedId !== 'string') {
    throw new BreedNotFoundErrorClass(breedId);
  }

  // Determine the species and target key
  let species: Species = petData?.species || 'dog';
  let targetKey = `${species}.default`;

  // Check for breed-specific target (e.g., "dog.large")
  if (BREED_NUTRITIONAL_TARGETS[breedId]) {
    targetKey = breedId;
  } else if (breedId.includes('large') || breedId.includes('Large')) {
    targetKey = `${species}.large`;
  }

  const target = BREED_NUTRITIONAL_TARGETS[targetKey];
  if (!target) {
    throw new BreedNotFoundErrorClass(breedId);
  }

  // Calculate recommended daily calories if pet data provided
  let recommendedDailyCalories = 0;
  if (petData?.weight && petData?.species) {
    recommendedDailyCalories = calculateDailyCalories(
      petData.weight,
      'moderate',
      petData.species,
      petData.neutered || false,
      breedId,
    );
  }

  return {
    breedId,
    breedName: formatBreedName(breedId),
    species,
    recommendedDailyCalories,
    nutritionalTargets: target,
  };
}

/**
 * Format breed ID to human-readable breed name
 */
function formatBreedName(breedId: string): string {
  return breedId
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ───────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Get today's meal logs for a pet
 */
export async function getTodaysMeals(petId: string): Promise<MealLog[]> {
  const allMeals = await getMealLogs(petId);
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return allMeals.filter((meal) => meal.date === today);
}

/**
 * Calculate total calories consumed in a day
 */
export function calculateDailyCaloriesConsumed(mealLog: MealLog[]): number {
  return mealLog.reduce((sum, meal) => sum + (meal.calories || 0), 0);
}

/**
 * Check if pet has met minimum daily intake
 */
export function hasMetMinimumDailyIntake(
  mealLog: MealLog[],
  requiredCalories: number,
  tolerancePercent: number = 10,
): boolean {
  const consumed = calculateDailyCaloriesConsumed(mealLog);
  const minimum = requiredCalories * ((100 - tolerancePercent) / 100);

  return consumed >= minimum;
}

/**
 * Get meal logs for a date range
 */
export async function getMealLogsForDateRange(
  petId: string,
  startDate: Date,
  endDate: Date,
): Promise<MealLog[]> {
  const allMeals = await getMealLogs(petId);
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  return allMeals.filter((meal) => meal.date >= start && meal.date <= end);
}

export type { MealLog, NutritionalGap, BreedRecommendation, BreedNotFoundError };
