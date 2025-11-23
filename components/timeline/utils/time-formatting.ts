/**
 * Time formatting utilities for timeline display
 */

/**
 * Format seconds to "MM:SS" or "HH:MM:SS" format
 * @param seconds Time in seconds
 * @param showHours Force showing hours even if < 1 hour
 * @returns Formatted time string
 *
 * @example
 * formatTime(65.5) // "01:05"
 * formatTime(3665.5) // "01:01:05"
 * formatTime(65.5, true) // "00:01:05"
 */
export const formatTime = (seconds: number, showHours = false): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (num: number) => num.toString().padStart(2, "0");

  if (hrs > 0 || showHours) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }

  return `${pad(mins)}:${pad(secs)}`;
};

/**
 * Format seconds to "MM:SS.mm" with milliseconds
 * @param seconds Time in seconds
 * @returns Formatted time string with milliseconds
 *
 * @example
 * formatTimeWithMillis(65.543) // "01:05.54"
 */
export const formatTimeWithMillis = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);

  const pad = (num: number) => num.toString().padStart(2, "0");

  return `${pad(mins)}:${pad(secs)}.${pad(millis)}`;
};

/**
 * Format seconds to frames based on fps
 * @param seconds Time in seconds
 * @param fps Frames per second
 * @returns Formatted time string with frames
 *
 * @example
 * formatTimeWithFrames(2.5, 30) // "00:02:15" (2 seconds, 15 frames)
 */
export const formatTimeWithFrames = (seconds: number, fps: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * fps);

  const pad = (num: number) => num.toString().padStart(2, "0");

  return `${pad(mins)}:${pad(secs)}:${pad(frames)}`;
};

/**
 * Get compact time format based on duration
 * For very short durations, show milliseconds
 * For longer durations, show MM:SS or HH:MM:SS
 *
 * @param seconds Time in seconds
 * @returns Formatted time string
 *
 * @example
 * getCompactTimeFormat(0.543) // "543ms"
 * getCompactTimeFormat(65.5) // "1:05"
 */
export const getCompactTimeFormat = (seconds: number): string => {
  if (seconds < 1) {
    return `${Math.floor(seconds * 1000)}ms`;
  }
  return formatTime(seconds);
};
