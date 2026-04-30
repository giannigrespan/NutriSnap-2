export interface UserProfile {
  userId: string;
  name: string;
  age: number;
  height: number;
  weight: number;
  gender: 'male' | 'female' | 'other';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose_weight' | 'maintain' | 'gain_muscle';
  dailyCalorieTarget: number;
  wahooAccessToken?: string;
  wahooRefreshToken?: string;
  wahooTokenExpiresAt?: number;
  createdAt: any;
  updatedAt?: any;
}

export interface FoodEntry {
  id?: string;
  userId: string;
  date: string;
  description: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes?: string;
  createdAt: any;
}

export interface WorkoutDetail {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface WeightLog {
  id?: string;
  userId: string;
  date: string;
  weight: number;
  createdAt: any;
}

export interface ExerciseEntry {
  id?: string;
  userId: string;
  date: string;
  activityType: string;
  durationMinutes: number;
  caloriesBurned: number;
  workoutDetails?: WorkoutDetail[];
  createdAt: any;
}
