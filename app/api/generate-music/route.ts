"use server";

import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import {
  AUDIO_MODELS,
  type AudioVendor,
  type AudioTrackResult,
} from "@/lib/audio-models";
import { getMusicAdapter } from "@/lib/audio-provider-factory";
import { mockMusicTrack, mockDelay } from "@/lib/demo-mocks/music";

const isAudioVendor = (value: unknown): value is AudioVendor =>
  typeof value === "string" &&
  ["replicate", "elevenlabs", "freesound", "local"].includes(value);

const isAudioModelKey = (value: unknown): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

const MUSIC_MODEL_ALIASES: Record<
  "lyria-2" | "musicgen" | "bark",
  keyof typeof AUDIO_MODELS
> = {
  "lyria-2": "lyria-2",
  musicgen: "musicgen-large",
  bark: "bark-v0",
};

type MusicModelAlias = keyof typeof MUSIC_MODEL_ALIASES;

const isMusicModelAlias = (value: unknown): value is MusicModelAlias =>
  typeof value === "string" && value in MUSIC_MODEL_ALIASES;

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const {
      prompt,
      duration,
      durationSeconds,
      referenceAudioUrl,
      style,
      tempo,
      model,
      modelKey,
      provider,
      negative_prompt,
      seed,
      history_prompt,
      text_temp,
      waveform_temp,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/generate-music", {
      prompt,
      duration,
      durationSeconds,
      style,
      tempo,
      model,
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
      const safeDuration =
        typeof duration === "number"
          ? duration
          : typeof durationSeconds === "number"
            ? durationSeconds
            : undefined;
      const mockTrack = mockMusicTrack(prompt, safeDuration);
      return apiResponse({
        success: true,
        modelKey: "mock-musicgen",
        track: mockTrack,
      });
    }

    // Resolve model key from aliases or use default
    const requestedModelKey = isAudioModelKey(modelKey)
      ? modelKey
      : isMusicModelAlias(model)
        ? MUSIC_MODEL_ALIASES[model]
        : undefined;
    const targetModelKey: keyof typeof AUDIO_MODELS =
      requestedModelKey ?? MUSIC_MODEL_ALIASES["lyria-2"];

    const adapter = getMusicAdapter({
      modelKey: targetModelKey,
      vendor: isAudioVendor(provider) ? provider : undefined,
    });

    flowTracker.trackDecision(
      "Select music adapter",
      adapter.providerKey,
      `Using ${adapter.providerKey} for music generation`,
    );

    const safeDuration =
      typeof duration === "number"
        ? duration
        : typeof durationSeconds === "number"
          ? durationSeconds
          : undefined;

    const buildRequest = () => ({
      prompt: prompt.trim(),
      durationSeconds: safeDuration,
      referenceAudioUrl:
        typeof referenceAudioUrl === "string" ? referenceAudioUrl : undefined,
      style: typeof style === "string" ? style : undefined,
      tempo: typeof tempo === "string" ? tempo : undefined,
      negativePrompt:
        typeof negative_prompt === "string" ? negative_prompt : undefined,
      seed: typeof seed === "number" ? seed : undefined,
      historyPrompt:
        typeof history_prompt === "string"
          ? history_prompt
          : history_prompt === null
            ? null
            : undefined,
      textTemperature: typeof text_temp === "number" ? text_temp : undefined,
      waveformTemperature:
        typeof waveform_temp === "number" ? waveform_temp : undefined,
    });

    const runGeneration = async (
      modelOverride: keyof typeof AUDIO_MODELS,
    ): Promise<GenerationResult> => {
      const overrideAdapter =
        modelOverride === adapter.providerKey
          ? adapter
          : getMusicAdapter({
              modelKey: modelOverride,
              vendor: isAudioVendor(provider) ? provider : undefined,
            });
      const track = await overrideAdapter.generateTrack(buildRequest());
      return { track, usedModelKey: overrideAdapter.providerKey };
    };

    type GenerationResult = {
      track: AudioTrackResult;
      usedModelKey: keyof typeof AUDIO_MODELS;
    };
    let generationResult: GenerationResult | null = null;
    let activeModelKey: keyof typeof AUDIO_MODELS = adapter.providerKey;

    try {
      generationResult = await runGeneration(targetModelKey);
      activeModelKey = generationResult.usedModelKey;
    } catch (primaryError) {
      // Fallback from Lyria 2 to MusicGen if it fails
      if (targetModelKey === "lyria-2") {
        flowTracker.trackDecision(
          "Lyria 2 fallback",
          "musicgen-large",
          "Lyria 2 generation failed, falling back to MusicGen Large",
        );
        console.warn(
          "Lyria 2 generation failed, falling back to MusicGen Large:",
          primaryError,
        );
        generationResult = await runGeneration("musicgen-large");
        activeModelKey = generationResult.usedModelKey;
      } else {
        throw primaryError;
      }
    }

    if (!generationResult) {
      throw new Error("Music generation failed");
    }

    const { track } = generationResult;

    return apiResponse({
      success: true,
      modelKey: activeModelKey,
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
