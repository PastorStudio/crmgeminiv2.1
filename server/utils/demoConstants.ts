/**
 * Demo User Constants
 * Centralized constants to ensure exactly 72 hours (3 days) for all demo users
 */

// Exactly 72 hours in milliseconds - DO NOT MODIFY
export const DEMO_DURATION_MS = 72 * 60 * 60 * 1000;

// Exactly 72 hours in hours
export const DEMO_DURATION_HOURS = 72;

// Exactly 3 days
export const DEMO_DURATION_DAYS = 3;

/**
 * Creates a demo expiration date exactly 72 hours from now
 * @returns Date object set to exactly 72 hours from creation
 */
export function createDemoExpirationDate(): Date {
  return new Date(Date.now() + DEMO_DURATION_MS);
}

/**
 * Checks if a demo user has expired
 * @param expirationDate The expiration date to check
 * @returns boolean indicating if the demo has expired
 */
export function isDemoExpired(expirationDate: Date): boolean {
  return new Date() > expirationDate;
}

/**
 * Gets remaining time in milliseconds for a demo user
 * @param expirationDate The expiration date
 * @returns Remaining time in milliseconds, or 0 if expired
 */
export function getDemoRemainingTimeMs(expirationDate: Date): number {
  const remaining = expirationDate.getTime() - Date.now();
  return Math.max(0, remaining);
}

/**
 * Gets remaining time in hours for a demo user
 * @param expirationDate The expiration date
 * @returns Remaining time in hours, or 0 if expired
 */
export function getDemoRemainingTimeHours(expirationDate: Date): number {
  const remainingMs = getDemoRemainingTimeMs(expirationDate);
  return Math.ceil(remainingMs / (60 * 60 * 1000));
}