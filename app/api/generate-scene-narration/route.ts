import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { synthesizeNarrationAudio } from "@/lib/narration";
import { getConvexClient } from "@/lib/server/convex";

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
      return NextResponse.json({ error: "sceneId is required" }, { status: 400 });
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Narration text is required" },
        { status: 400 },
      );
    }

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json(
        { error: "voiceId is required" },
        { status: 400 },
      );
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return NextResponse.json(
        { error: "Narration text must contain characters" },
        { status: 400 },
      );
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

    return NextResponse.json({
      success: true,
      audioUrl,
      truncated,
      narrationText: sanitizedText,
    });
  } catch (error) {
    console.error("Failed to generate scene narration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate narration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
