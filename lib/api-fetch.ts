/**
 * Enhanced fetch wrapper that automatically handles flow event tracking
 *
 * Usage: Replace `fetch()` with `apiFetch()` in client components
 *
 * This automatically:
 * - Sends demo mode headers
 * - Imports flow events from responses
 * - Logs API calls for debugging
 */

import { getDemoMode } from "./demo-mode";
import { getFlowTracker } from "./flow-tracker";

interface ApiFetchOptions extends RequestInit {
  skipFlowTracking?: boolean; // Opt-out if needed
}

export async function apiFetch(
  url: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { skipFlowTracking = false, ...fetchOptions } = options;

  // Auto-add demo mode header
  const demoMode = getDemoMode();
  const headers = new Headers(fetchOptions.headers);

  if (demoMode !== "off") {
    headers.set("x-demo-mode", demoMode);
  }

  // Make the actual fetch call
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Auto-import flow events from response (if present)
  if (!skipFlowTracking && response.ok) {
    try {
      const clone = response.clone();
      const data = await clone.json();

      if (data._flowEvents && Array.isArray(data._flowEvents)) {
        const tracker = getFlowTracker();
        tracker.importEvents(data._flowEvents);
      }
    } catch (error) {
      // Ignore - response might not be JSON
    }
  }

  return response;
}

/**
 * Convenience wrapper for JSON API calls
 */
export async function apiFetchJSON<T = any>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await apiFetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API call failed: ${response.status} ${error}`);
  }

  return response.json();
}
