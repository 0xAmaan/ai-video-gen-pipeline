/**
 * Centralized logging utility
 * 
 * Provides structured logging with automatic environment detection.
 * Debug logs are only shown in development mode.
 */

const isDevelopment = () => {
  return process.env.NODE_ENV === "development";
};

/**
 * Log an error (always shown)
 */
export function logError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.error(`[ERROR] ${message}:`, error.message);
    if (isDevelopment() && error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(`[ERROR] ${message}:`, error);
  }
}

/**
 * Log informational message (always shown)
 */
export function logInfo(message: string, ...args: unknown[]): void {
  console.log(`[INFO] ${message}`, ...args);
}

/**
 * Log debug message (only in development)
 */
export function logDebug(message: string, ...args: unknown[]): void {
  if (isDevelopment()) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * Log API call (only in development)
 */
export function logAPI(method: string, url: string, ...args: unknown[]): void {
  if (isDevelopment()) {
    console.log(`[API] ${method} ${url}`, ...args);
  }
}

