"use server";

import Replicate from "replicate";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { apiError, apiResponse } from "@/lib/api-response";
import { getFlowTracker } from "@/lib/flow-tracker";
import {
  sanitizeNarrationText,
  normalizeVoiceSettings,
} from "@/lib/narration";
import { extractReplicateUrl } from "@/lib/replicate";
import { getConvexClient } from "@/lib/server/convex";

const MODEL_ID =
  process.env.REPLICATE_MINIMAX_TTS_TURBO_MODEL ??
  process.env.REPLICATE_MINIMAX_TTS_MODEL ??
  process.env.REPLICATE_MINIMAX_TTS_MODEL_ID ??
  "minimax/speech-02-turbo";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const deriveDuration = (
  output: unknown,
  fallback: number,
): number | null => {
  if (Array.isArray(output)) {
    for (const item of output) {
      const duration = deriveDuration(item, fallback);
      if (duration !== null) return duration;
    }
  }
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const candidates = [
      record.duration,
      record.audio_duration,
      record.seconds,
      record.duration_seconds,
      record.audio_seconds,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  }
  return fallback || null;
};

const estimateSpeechDuration = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  const wordsPerSecond = 2.6; // ~155 wpm conversational pacing
  return Math.max(1, Math.round(words / wordsPerSecond));
};

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  let projectId: Id<"videoProjects"> | undefined;

  try {
    const body = await req.json();
    projectId = body?.projectId as Id<"videoProjects"> | undefined;
    const script = typeof body?.script === "string" ? body.script : "";
    const voiceId = typeof body?.voiceId === "string" ? body.voiceId : undefined;
    const emotion =
      typeof body?.emotion === "string" ? body.emotion : undefined;
    const speed = typeof body?.speed === "number" ? body.speed : undefined;
    const pitch = typeof body?.pitch === "number" ? body.pitch : undefined;
    const sampleRate =
      typeof body?.sample_rate === "number" ? body.sample_rate : undefined;
    const audioFormat =
      typeof body?.audio_format === "string" ? body.audio_format : undefined;
    const bitrate =
      typeof body?.bitrate === "number" ? body.bitrate : undefined;
    const channel =
      typeof body?.channel === "string" ? body.channel : undefined;
    const volume =
      typeof body?.volume === "number" ? body.volume : undefined;
    const languageBoost =
      typeof body?.language_boost === "string"
        ? body.language_boost
        : undefined;
    const subtitleEnable =
      typeof body?.subtitle_enable === "boolean"
        ? body.subtitle_enable
        : undefined;
    const englishNormalization =
      typeof body?.english_normalization === "boolean"
        ? body.english_normalization
        : undefined;

    if (!projectId) {
      return apiError("projectId is required", 400);
    }

    const { text: sanitizedScript, truncated } =
      sanitizeNarrationText(script);
    if (!sanitizedScript) {
      return apiError("Voiceover script is required", 400);
    }

    if (!process.env.REPLICATE_API_KEY) {
      return apiError("Replicate API key is not configured", 500);
    }

    const convex = await getConvexClient();
    const [projectData, voiceSettings, existingAssets] = await Promise.all([
      convex.query(api.video.getProjectWithAllData, { projectId }),
      convex
        .query(api.video.getProjectVoiceSettings, { projectId })
        .catch(() => null),
      convex.query(api.video.getAudioAssets, { projectId }).catch(() => []),
    ]);

    if (!projectData?.project) {
      return apiError("Project not found", 404);
    }

    const normalizedVoice = normalizeVoiceSettings({
      voiceId: voiceId ?? voiceSettings?.selectedVoiceId ?? "Wise_Woman",
      emotion: emotion ?? voiceSettings?.emotion ?? "auto",
      speed: speed ?? voiceSettings?.speed ?? 1,
      pitch: pitch ?? voiceSettings?.pitch ?? 0,
    });

    flowTracker.trackAPICall("POST", "/api/generate-voiceover", {
      projectId,
      model: MODEL_ID,
    });
    flowTracker.trackModelSelection(
      "MiniMax Speech Turbo",
      MODEL_ID,
      undefined,
      "Generating ad-style voiceover",
    );

    const replicateClient = new Replicate({
      auth: process.env.REPLICATE_API_KEY,
    });

    const input: Record<string, unknown> = {
      text: sanitizedScript,
      voice_id: normalizedVoice.voiceId,
      emotion: normalizedVoice.emotion,
      speed: normalizedVoice.speed,
      pitch: normalizedVoice.pitch,
    };

    if (typeof sampleRate === "number") input.sample_rate = sampleRate;
    if (typeof audioFormat === "string") input.audio_format = audioFormat;
    if (typeof bitrate === "number") input.bitrate = bitrate;
    if (typeof channel === "string") input.channel = channel;
    if (typeof volume === "number") input.volume = volume;
    if (typeof languageBoost === "string") {
      input.language_boost = languageBoost;
    }
    if (typeof subtitleEnable === "boolean") {
      input.subtitle_enable = subtitleEnable;
    }
    if (typeof englishNormalization === "boolean") {
      input.english_normalization = englishNormalization;
    }

    const prediction = await replicateClient.predictions.create({
      model: MODEL_ID,
      input,
    });

    const maxAttempts = 30;
    let finalPrediction = prediction;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (finalPrediction.status === "succeeded") break;
      if (
        finalPrediction.status === "failed" ||
        finalPrediction.status === "canceled"
      ) {
        const message =
          typeof finalPrediction.error === "string"
            ? finalPrediction.error
            : "Voiceover generation failed before completion";
        throw new Error(message);
      }
      await wait(1200);
      finalPrediction = await replicateClient.predictions.get(
        finalPrediction.id,
      );
    }

    if (finalPrediction.status !== "succeeded") {
      const message =
        typeof finalPrediction.error === "string"
          ? finalPrediction.error
          : `Voiceover generation did not complete (status: ${finalPrediction.status})`;
      throw new Error(message);
    }

    const audioUrl = extractReplicateUrl(
      finalPrediction.output,
      "MiniMax voiceover",
    );
    const resolvedDuration =
      deriveDuration(
        finalPrediction.output,
        estimateSpeechDuration(sanitizedScript),
      ) ?? estimateSpeechDuration(sanitizedScript);

    const deletions =
      existingAssets
        ?.filter(
          (asset) =>
            asset.type === "voiceover" &&
            asset.source === "generated" &&
            asset.projectId === projectId,
        )
        .map((asset) =>
          convex.mutation(api.video.deleteAudioAsset, {
            assetId: asset._id,
          }),
        ) ?? [];
    if (deletions.length > 0) {
      await Promise.allSettled(deletions);
    }

    const assetId = await convex.mutation(api.video.createAudioAsset, {
      projectId,
      type: "voiceover",
      source: "generated",
      provider: "minimax",
      modelKey: "replicate-minimax-tts",
      url: audioUrl,
      duration: resolvedDuration,
      prompt: sanitizedScript,
      timelineStart: 0,
      timelineEnd: resolvedDuration,
      metadata: {
        voiceId: normalizedVoice.voiceId,
        voiceName: normalizedVoice.voiceName,
        emotion: normalizedVoice.emotion,
        speed: normalizedVoice.speed,
        pitch: normalizedVoice.pitch,
        model: MODEL_ID,
        predictionId: finalPrediction.id,
        truncated,
        sampleRate: sampleRate ?? "default",
        audioFormat: audioFormat ?? "wav",
        volume,
        languageBoost,
        subtitleEnable,
        englishNormalization,
      },
    });

    return apiResponse({
      success: true,
      projectId,
      voiceoverUrl: audioUrl,
      durationSeconds: resolvedDuration,
      voiceId: normalizedVoice.voiceId,
      voiceName: normalizedVoice.voiceName,
      truncated,
      assetId,
      predictionId: finalPrediction.id,
      model: MODEL_ID,
      script: sanitizedScript,
    });
  } catch (error) {
    console.error("generate-voiceover error:", error);
    return apiError(
      "Failed to generate voiceover",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
