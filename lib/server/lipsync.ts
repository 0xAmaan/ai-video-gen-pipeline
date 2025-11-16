import Replicate from "replicate";
import type { LipsyncStatus } from "@/types/scene";

export const LIPSYNC_MODEL_VERSION =
  "3190ef7dc0cbca29458d0032c032ef140a840087141cf10333e8d19a213f9194";

const ALLOWED_SYNC_MODES = new Set([
  "loop",
  "bounce",
  "cut_off",
  "silence",
  "remap",
]);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export interface LipSyncPredictionInput {
  videoUrl: string;
  audioUrl: string;
  syncMode?: string;
  temperature?: number;
  activeSpeaker?: boolean;
}

export async function startLipSyncPrediction(
  input: LipSyncPredictionInput,
) {
  if (!input.videoUrl || !input.audioUrl) {
    throw new Error("Video and audio URLs are required for lip sync.");
  }

  const syncMode =
    input.syncMode && ALLOWED_SYNC_MODES.has(input.syncMode)
      ? input.syncMode
      : "cut_off";

  const temperature = clamp(
    Number.isFinite(input.temperature) ? Number(input.temperature) : 0.5,
    0,
    1,
  );

  return await replicate.predictions.create({
    version: LIPSYNC_MODEL_VERSION,
    input: {
      video: input.videoUrl,
      audio: input.audioUrl,
      sync_mode: syncMode,
      temperature,
      active_speaker: Boolean(input.activeSpeaker),
    },
  });
}

export async function getLipSyncPrediction(predictionId: string) {
  if (!predictionId) {
    throw new Error("predictionId is required");
  }
  return await replicate.predictions.get(predictionId);
}

export function extractLipsyncVideoUrl(output: unknown): string | null {
  if (!output) {
    return null;
  }

  if (typeof output === "string") {
    return output;
  }

  if (
    typeof output === "object" &&
    output !== null &&
    "url" in output &&
    typeof (output as { url?: unknown }).url === "function"
  ) {
    return ((output as { url: () => string }).url?.() as string) ?? null;
  }

  if (
    typeof output === "object" &&
    output !== null &&
    "url" in output &&
    typeof (output as { url?: unknown }).url === "string"
  ) {
    return ((output as { url: string }).url as string) ?? null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractLipsyncVideoUrl(item);
      if (url) return url;
    }
  }

  return null;
}

export function mapReplicateStatusToLipsync(
  status: string | null | undefined,
): LipsyncStatus {
  switch (status) {
    case "succeeded":
      return "complete";
    case "failed":
    case "canceled":
      return "failed";
    case "starting":
    case "processing":
    default:
      return "processing";
  }
}
