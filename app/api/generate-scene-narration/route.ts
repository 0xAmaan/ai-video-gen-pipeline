import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AUDIO_MODELS, type AudioVendor } from "@/lib/audio-models";
import {
  synthesizeNarrationAudio,
  sanitizeNarrationText,
} from "@/lib/narration";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";
import { getConvexClient } from "@/lib/server/convex";
import { apiResponse, apiError } from "@/lib/api-response";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";

const isAudioVendor = (value: unknown): value is AudioVendor =>
  typeof value === "string" &&
  ["replicate", "elevenlabs", "freesound", "local"].includes(value);

const isAudioModelKey = (value: unknown): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

const stripSSML = (value: string) => value.replace(/<[^>]+>/g, " ");

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const {
      sceneId,
      text,
      voiceId,
      emotion = "auto",
      speed = 1,
      pitch = 0,
      provider,
      voiceModelKey,
      ssml,
      outputFormat,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/generate-scene-narration", {
      sceneId,
      provider,
      demoMode,
    });

    if (!sceneId || typeof sceneId !== "string") {
      return apiError("sceneId is required", 400);
    }

    if ((!text || typeof text !== "string") && typeof ssml !== "string") {
      return apiError("Narration text or SSML is required", 400);
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

      const ssmlInput =
        typeof ssml === "string" && ssml.trim().length > 0 ? ssml : undefined;
      const textInput =
        typeof text === "string" && text.trim().length > 0 ? text.trim() : "";
      const baseText = ssmlInput ? stripSSML(ssmlInput) : textInput;

      const { text: sanitizedText, truncated } =
        sanitizeNarrationText(baseText);
      if (!sanitizedText) {
        return apiError("Narration text must contain characters", 400);
      }

      const voiceResult = await adapter.synthesizeVoice({
        text: sanitizedText,
        ssml: ssmlInput,
        voiceId: typeof voiceId === "string" ? voiceId : undefined,
        emotion: typeof emotion === "string" ? emotion : undefined,
        speed: typeof speed === "number" ? speed : undefined,
        pitch: typeof pitch === "number" ? pitch : undefined,
        outputFormat:
          typeof outputFormat === "string" ? outputFormat : undefined,
      });

      const convex = await getConvexClient();

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
        narrationText: sanitizedText,
        voiceId: voiceResult.voiceId,
        voiceName: voiceResult.voiceName,
      });
    } else {
      // Use default Replicate/MiniMax narration
      flowTracker.trackDecision(
        "Select voice provider",
        "replicate",
        "Using Replicate/MiniMax for voice synthesis",
      );

      if (!voiceId || typeof voiceId !== "string") {
        return apiError("voiceId is required", 400);
      }

      const trimmedText = text.trim();
      if (!trimmedText) {
        return apiError("Narration text must contain characters", 400);
      }

      const {
        audioUrl,
        sanitizedText,
        truncated,
        voiceId: normalizedVoiceId,
        voiceName,
      } = await synthesizeNarrationAudio({
        text: trimmedText,
        voiceId,
        emotion,
        speed,
        pitch,
      });

      const convex = await getConvexClient();

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
        narrationText: sanitizedText,
      });
    }
  } catch (error) {
    console.error("Failed to generate scene narration:", error);
    return apiError(
      "Failed to generate narration",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
