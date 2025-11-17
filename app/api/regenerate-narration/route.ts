import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { synthesizeNarrationAudio } from "@/lib/narration";
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { mockNarrationSynthesis, mockDelay } from "@/lib/demo-mocks";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const { sceneId, newVoiceId, newEmotion, newSpeed, newPitch, customText } =
      await req.json();

    flowTracker.trackAPICall("POST", "/api/regenerate-narration", {
      sceneId,
      voiceId: newVoiceId,
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
  } catch (error) {
    console.error("Failed to regenerate narration:", error);
    return apiError(
      "Failed to regenerate narration",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
