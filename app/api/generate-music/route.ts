"use server";

import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { AUDIO_MODELS, type AudioVendor } from "@/lib/audio-models";
import { getMusicAdapter } from "@/lib/audio-provider-factory";
import { mockMusicTrack, mockDelay } from "@/lib/demo-mocks/music";

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
      prompt,
      durationSeconds,
      referenceAudioUrl,
      style,
      tempo,
      modelKey,
      provider,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/generate-music", {
      prompt,
      durationSeconds,
      style,
      tempo,
      modelKey,
      provider,
      demoMode,
    });

    if (!prompt || typeof prompt !== "string") {
      return apiError("prompt is required", 400);
    }

    // Demo mode check
    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock music track",
      );
      await mockDelay(800);
      const mockTrack = mockMusicTrack(prompt, durationSeconds);
      return apiResponse({
        success: true,
        modelKey: "mock-musicgen",
        track: mockTrack,
      });
    }

    const adapter = getMusicAdapter({
      modelKey: isAudioModelKey(modelKey) ? modelKey : undefined,
      vendor: isAudioVendor(provider) ? provider : undefined,
    });

    flowTracker.trackDecision(
      "Select music adapter",
      adapter.providerKey,
      `Using ${adapter.providerKey} for music generation`,
    );

    const track = await adapter.generateTrack({
      prompt: prompt.trim(),
      durationSeconds:
        typeof durationSeconds === "number" ? durationSeconds : undefined,
      referenceAudioUrl:
        typeof referenceAudioUrl === "string" ? referenceAudioUrl : undefined,
      style: typeof style === "string" ? style : undefined,
      tempo: typeof tempo === "string" ? tempo : undefined,
    });

    return apiResponse({
      success: true,
      modelKey: adapter.providerKey,
      track,
    });
  } catch (error) {
    console.error("generate-music error:", error);
    return apiError(
      "Failed to generate music",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
