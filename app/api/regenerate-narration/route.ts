"use server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AUDIO_MODELS, type AudioVendor } from "@/lib/audio-models";
import { sanitizeNarrationText } from "@/lib/narration";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";
import { getConvexClient } from "@/lib/server/convex";
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";

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
      sceneId,
      newVoiceId,
      newEmotion,
      newSpeed,
      newPitch,
      customText,
      voiceProvider,
      voiceModelKey,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/regenerate-narration", {
      sceneId,
      voiceProvider,
      demoMode,
    });

    if (!sceneId || typeof sceneId !== "string") {
      return apiError("sceneId is required", 400);
    }

    const convex = await getConvexClient();
    const scene = await convex.query(api.video.getSceneById, {
      sceneId: sceneId as Id<"scenes">,
    });

    if (!scene) {
      return apiError("Scene not found", 404);
    }

    const baseText =
      typeof customText === "string" && customText.trim().length > 0
        ? customText.trim()
        : scene.narrationText || "";

    if (!baseText) {
      return apiError(
        "Scene has no narration text. Provide customText to regenerate.",
        400,
      );
    }

    const projectVoiceSettings = await convex.query(
      api.video.getProjectVoiceSettings,
      {
        projectId: scene.projectId as Id<"videoProjects">,
      },
    );

    const resolvedProvider =
      (isAudioVendor(voiceProvider) ? voiceProvider : undefined) ??
      (projectVoiceSettings?.voiceProvider as AudioVendor | undefined) ??
      "replicate";

    const voiceId =
      newVoiceId ||
      scene.voiceId ||
      projectVoiceSettings?.selectedVoiceId ||
      "Wise_Woman";

    const emotion = newEmotion || projectVoiceSettings?.emotion || "auto";

    const speed =
      typeof newSpeed === "number"
        ? newSpeed
        : (projectVoiceSettings?.speed ?? 1);

    const pitch =
      typeof newPitch === "number"
        ? newPitch
        : (projectVoiceSettings?.pitch ?? 0);

    const adapter = getVoiceAdapter({
      vendor: resolvedProvider,
      modelKey: isAudioModelKey(voiceModelKey)
        ? voiceModelKey
        : projectVoiceSettings?.voiceModelKey,
    });

    flowTracker.trackDecision(
      "Select voice provider",
      adapter.vendor,
      `Using ${adapter.vendor} for narration regeneration`,
    );

    const { text: sanitizedText, truncated } = sanitizeNarrationText(baseText);

    const voiceResult = await adapter.synthesizeVoice({
      text: sanitizedText,
      voiceId,
      emotion,
      speed,
      pitch,
    });

    await convex.mutation(api.video.updateSceneNarration, {
      sceneId: sceneId as Id<"scenes">,
      narrationUrl: voiceResult.audioUrl,
      narrationText: sanitizedText,
      voiceId: voiceResult.voiceId,
      voiceName: voiceResult.voiceName,
    });

    return apiResponse({
      success: true,
      audioUrl: voiceResult.audioUrl,
      truncated,
      voiceId: voiceResult.voiceId,
      voiceName: voiceResult.voiceName,
      narrationText: sanitizedText,
      provider: resolvedProvider,
      modelKey: adapter.providerKey,
      format: voiceResult.format,
    });
  } catch (error) {
    console.error("Failed to regenerate narration:", error);
    return apiError(
      "Failed to regenerate narration",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
