/**
 * Formats time in seconds to MM:SS format
 * @param seconds - Time in seconds (can be decimal)
 * @returns Formatted string (MM:SS)
 */
export const formatTime = (seconds: number): string => {
  if (!seconds || seconds < 0) return "00:00";

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  const minutesStr = String(minutes).padStart(2, "0");
  const secondsStr = String(remainingSeconds).padStart(2, "0");

  return `${minutesStr}:${secondsStr}`;
};

/**
 * Formats time in seconds to HH:MM:SS format (for longer videos)
 * @param seconds - Time in seconds (can be decimal)
 * @returns Formatted string (HH:MM:SS or MM:SS)
 */
export const formatTimeExtended = (seconds: number): string => {
  if (!seconds || seconds < 0) return "00:00";

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const minutesStr = String(minutes).padStart(2, "0");
  const secondsStr = String(remainingSeconds).padStart(2, "0");

  // Only show hours if video is > 1 hour
  if (hours > 0) {
    const hoursStr = String(hours).padStart(2, "0");
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
  }

  return `${minutesStr}:${secondsStr}`;
};

/**
 * Parses time string (MM:SS or HH:MM:SS) to seconds
 * @param timeStr - Time string to parse
 * @returns Time in seconds
 */
export const parseTimeString = (timeStr: string): number => {
  const parts = timeStr.split(":").map(Number);

  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
};
