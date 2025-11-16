import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { synthesizeNarrationAudio } from "@/lib/narration";

export async function POST(req: Request) {
  try {
    const {
      sceneId,
      newVoiceId,
      newEmotion,
      newSpeed,
      newPitch,
      customText,
    } = await req.json();

    if (!sceneId || typeof sceneId !== "string") {
      return NextResponse.json({ error: "sceneId is required" }, { status: 400 });
    }

    const convex = await getConvexClient();
    const scene = await convex.query(api.video.getSceneById, {
      sceneId: sceneId as Id<"scenes">,
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 },
      );
    }

    const baseText =
      typeof customText === "string" && customText.trim().length > 0
        ? customText.trim()
        : scene.narrationText || "";

    if (!baseText) {
      return NextResponse.json(
        { error: "Scene has no narration text. Provide customText to regenerate." },
        { status: 400 },
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

    const emotion =
      newEmotion ||
      projectVoiceSettings?.emotion ||
      "auto";

    const speed =
      typeof newSpeed === "number"
        ? newSpeed
        : projectVoiceSettings?.speed ?? 1;

    const pitch =
      typeof newPitch === "number"
        ? newPitch
        : projectVoiceSettings?.pitch ?? 0;

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

    return NextResponse.json({
      success: true,
      audioUrl,
      truncated,
      voiceId: normalizedVoiceId,
      voiceName,
      narrationText: sanitizedText,
    });
  } catch (error) {
    console.error("Failed to regenerate narration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to regenerate narration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
