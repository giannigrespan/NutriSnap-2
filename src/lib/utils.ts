import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('it-IT').format(num);
}

export function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  if (gender === 'male') {
    return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const factors: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return bmr * (factors[activityLevel] || 1.2);
}

export function safeDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val?.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}
