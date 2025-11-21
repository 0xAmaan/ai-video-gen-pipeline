/**
 * Utility to create API responses with automatic flow event tracking
 *
 * Usage in API routes:
 *
 * Instead of:
 *   return NextResponse.json({ success: true, data: ... });
 *
 * Use:
 *   return apiResponse({ success: true, data: ... });
 *
 * This automatically appends _flowEvents to the response.
 */

import { NextResponse } from "next/server";
import { getFlowTracker } from "./flow-tracker";

interface ApiResponseOptions {
  status?: number;
  headers?: HeadersInit;
  skipFlowEvents?: boolean; // Opt-out if needed
}

/**
 * Create a JSON response with automatic flow event tracking
 */
export function apiResponse<T extends Record<string, any>>(
  data: T,
  options: ApiResponseOptions = {},
): NextResponse {
  const { status = 200, headers, skipFlowEvents = false } = options;

  // Automatically append flow events unless opted out
  const responseData = skipFlowEvents
    ? data
    : {
        ...data,
        _flowEvents: getFlowTracker().getEvents(),
      };

  return NextResponse.json(responseData, {
    status,
    headers,
  });
}

/**
 * Create an error response with automatic flow event tracking
 */
export function apiError(
  error: string,
  status: number = 500,
  details?: any,
): NextResponse {
  return apiResponse(
    {
      error,
      details,
    },
    { status },
  );
}
