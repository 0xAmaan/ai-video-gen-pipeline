"use server";

import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { AUDIO_MODELS, type AudioVendor } from "@/lib/audio-models";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";
import { mockElevenLabsVoice, mockDelay } from "@/lib/demo-mocks/music";

const isAudioModelKey = (value: unknown): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

const ELEVENLABS_VENDOR: AudioVendor = "elevenlabs";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const {
      text,
      ssml,
      voiceId,
      emotion,
      speed,
      pitch,
      outputFormat,
      modelKey,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/generate-voice-elevenlabs", {
      textLength: text?.length,
      voiceId,
      emotion,
      speed,
      pitch,
      demoMode,
    });

    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasSsml = typeof ssml === "string" && ssml.trim().length > 0;
    if (!hasText && !hasSsml) {
      return apiError("text or ssml is required", 400);
    }

    // Demo mode check
    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock ElevenLabs voice",
      );
      await mockDelay(600);
      const mockVoice = mockElevenLabsVoice(text || ssml || "", voiceId);
      return apiResponse({
        success: true,
        modelKey: "mock-elevenlabs",
        ...mockVoice,
      });
    }

    const adapter = getVoiceAdapter({
      vendor: ELEVENLABS_VENDOR,
      modelKey: isAudioModelKey(modelKey) ? modelKey : undefined,
    });

    flowTracker.trackDecision(
      "Select voice adapter",
      adapter.providerKey,
      `Using ${adapter.providerKey} for voice synthesis`,
    );

    const result = await adapter.synthesizeVoice({
      text: hasText ? text.trim() : "",
      ssml: hasSsml ? ssml : undefined,
      voiceId: typeof voiceId === "string" ? voiceId : undefined,
      emotion: typeof emotion === "string" ? emotion : undefined,
      speed: typeof speed === "number" ? speed : undefined,
      pitch: typeof pitch === "number" ? pitch : undefined,
      outputFormat: typeof outputFormat === "string" ? outputFormat : undefined,
    });

    return apiResponse({
      success: true,
      modelKey: adapter.providerKey,
      audioUrl: result.audioUrl,
      format: result.format,
      durationSeconds: result.durationSeconds,
      voiceId: result.voiceId,
      voiceName: result.voiceName,
    });
  } catch (error) {
    console.error("generate-voice-elevenlabs error:", error);
    return apiError(
      "Failed to generate voice via ElevenLabs",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
