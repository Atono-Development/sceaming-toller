/**
 * Date utility functions for handling UTC to local date conversions
 */

/**
 * Converts a UTC date string to a local Date object at midnight (00:00:00)
 * This fixes timezone issues where UTC dates are interpreted incorrectly in local timezone
 *
 * @param dateString - The UTC date string to convert
 * @returns Date object representing the local date at midnight
 */
export const utcToLocalDate = (dateString: string): Date => {
  const utcDate = new Date(dateString);
  return new Date(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth(),
    utcDate.getUTCDate()
  );
};

/**
 * Gets today's date at midnight (00:00:00) for date comparisons
 *
 * @returns Date object representing today at midnight
 */
export const getTodayAtMidnight = (): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

/**
 * Checks if a game date is in the past
 *
 * @param dateString - The UTC date string of the game
 * @returns boolean indicating if the game is in the past
 */
export const isGameInPast = (dateString: string): boolean => {
  const today = getTodayAtMidnight();
  const gameDate = utcToLocalDate(dateString);
  return gameDate < today;
};

/**
 * Checks if a game date is today or in the future
 *
 * @param dateString - The UTC date string of the game
 * @returns boolean indicating if the game is today or upcoming
 */
export const isGameUpcoming = (dateString: string): boolean => {
  const today = getTodayAtMidnight();
  const gameDate = utcToLocalDate(dateString);
  return gameDate >= today;
};
