import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import {
  synthesizeNarrationAudio,
  sanitizeNarrationText,
} from "@/lib/narration";
import { AUDIO_MODELS, type AudioVendor } from "@/lib/audio-models";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { mockNarrationSynthesis, mockDelay } from "@/lib/demo-mocks";

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
      provider,
      voiceModelKey,
      ssml,
      outputFormat,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/regenerate-narration", {
      sceneId,
      voiceId: newVoiceId,
      provider,
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

    // Demo mode: Return mock narration instantly
    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock narration synthesis - zero API costs",
      );
      await mockDelay(200);
      const mockNarration = mockNarrationSynthesis();

      await convex.mutation(api.video.updateSceneNarration, {
        sceneId: sceneId as Id<"scenes">,
        narrationUrl: mockNarration.audio_url,
        narrationText: baseText,
        voiceId,
        voiceName: "Demo Voice",
      });

      return apiResponse({
        success: true,
        audioUrl: mockNarration.audio_url,
        truncated: false,
        voiceId,
        voiceName: "Demo Voice",
        narrationText: baseText,
      });
    }

    // Determine which provider to use
    const resolvedVendor = isAudioVendor(provider) ? provider : undefined;
    const useElevenLabs = resolvedVendor === "elevenlabs";

    if (useElevenLabs) {
      // Use ElevenLabs adapter
      flowTracker.trackDecision(
        "Select voice provider",
        "elevenlabs",
        "Using ElevenLabs for premium voice synthesis",
      );

      const adapter = getVoiceAdapter({
        vendor: resolvedVendor,
        modelKey: isAudioModelKey(voiceModelKey) ? voiceModelKey : undefined,
      });

      const { text: sanitizedText, truncated } =
        sanitizeNarrationText(baseText);

      const voiceResult = await adapter.synthesizeVoice({
        text: sanitizedText,
        ssml: typeof ssml === "string" ? ssml : undefined,
        voiceId: voiceId,
        emotion: emotion,
        speed: speed,
        pitch: pitch,
        outputFormat:
          typeof outputFormat === "string" ? outputFormat : undefined,
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
      });
    } else {
      // Use default Replicate/MiniMax narration
      flowTracker.trackDecision(
        "Select voice provider",
        "replicate",
        "Using Replicate/MiniMax for voice synthesis",
      );

      const {
        audioUrl,
        sanitizedText,
        truncated,
        voiceId: normalizedVoiceId,
        voiceName,
      } = await synthesizeNarrationAudio({
        text: baseText,
        voiceId,
        emotion,
        speed,
        pitch,
      });

      await convex.mutation(api.video.updateSceneNarration, {
        sceneId: sceneId as Id<"scenes">,
        narrationUrl: audioUrl,
        narrationText: sanitizedText,
        voiceId: normalizedVoiceId,
        voiceName,
      });

      return apiResponse({
        success: true,
        audioUrl,
        truncated,
        voiceId: normalizedVoiceId,
        voiceName,
        narrationText: sanitizedText,
      });
    }
  } catch (error) {
    console.error("Failed to regenerate narration:", error);
    return apiError(
      "Failed to regenerate narration",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
