/**
 * Client-side demo mode utilities
 */

import { getDemoMode } from "./demo-mode";

/**
 * Get headers to include demo mode in API requests
 */
export const getDemoModeHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return {};

  const demoMode = getDemoMode();
  if (demoMode === "off") return {};

  return {
    "x-demo-mode": demoMode,
  };
};

/**
 * Enhanced fetch that automatically includes demo mode headers
 */
export const demoFetch = async (
  url: string,
  options?: RequestInit,
): Promise<Response> => {
  const demoHeaders = getDemoModeHeaders();

  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...demoHeaders,
    },
  });
};
