"use server";

import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { AUDIO_MODELS, type AudioVendor } from "@/lib/audio-models";
import { getSoundLibraryAdapter } from "@/lib/audio-provider-factory";
import { mockAudioSearchResults, mockDelay } from "@/lib/demo-mocks/music";

const isAudioVendor = (value: unknown): value is AudioVendor =>
  typeof value === "string" &&
  ["replicate", "elevenlabs", "freesound", "local"].includes(value);

const isAudioModelKey = (value: unknown): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const {
      query,
      category,
      mood,
      durationRange,
      page,
      perPage,
      modelKey,
      provider,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/search-audio", {
      query,
      category,
      mood,
      page,
      perPage,
      demoMode,
    });

    if (typeof query !== "string" || query.trim().length === 0) {
      return apiError("query is required", 400);
    }

    // Demo mode check
    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock audio search results",
      );
      await mockDelay(500);
      const mockResults = mockAudioSearchResults(query, page, perPage);
      return apiResponse({
        success: true,
        modelKey: "mock-freesound",
        results: mockResults,
      });
    }

    const adapter = getSoundLibraryAdapter({
      modelKey: isAudioModelKey(modelKey) ? modelKey : undefined,
      vendor: isAudioVendor(provider) ? provider : undefined,
    });

    flowTracker.trackDecision(
      "Select sound library adapter",
      adapter.providerKey,
      `Using ${adapter.providerKey} for audio search`,
    );

    const results = await adapter.searchLibrary({
      query: query.trim(),
      category: typeof category === "string" ? category : undefined,
      mood: typeof mood === "string" ? mood : undefined,
      durationRange:
        Array.isArray(durationRange) && durationRange.length === 2
          ? [Number(durationRange[0]) || 0, Number(durationRange[1]) || 0]
          : undefined,
      page: typeof page === "number" ? page : undefined,
      perPage: typeof perPage === "number" ? perPage : undefined,
    });

    return apiResponse({
      success: true,
      modelKey: adapter.providerKey,
      results,
    });
  } catch (error) {
    console.error("search-audio error:", error);
    return apiError(
      "Failed to search audio",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
