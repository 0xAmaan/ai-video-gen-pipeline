import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { synthesizeNarrationAudio } from "@/lib/narration";
import { getConvexClient } from "@/lib/server/convex";
import { apiResponse, apiError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const {
      sceneId,
      text,
      voiceId,
      emotion = "auto",
      speed = 1,
      pitch = 0,
    } = await req.json();

    if (!sceneId || typeof sceneId !== "string") {
      return apiError("sceneId is required", 400);
    }

    if (!text || typeof text !== "string") {
      return apiError("Narration text is required", 400);
    }

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
  } catch (error) {
    console.error("Failed to generate scene narration:", error);
    return apiError(
      "Failed to generate narration",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
