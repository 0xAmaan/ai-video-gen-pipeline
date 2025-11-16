import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { startLipSyncPrediction } from "@/lib/server/lipsync";

type SceneId = Id<"scenes">;
type ClipId = Id<"videoClips">;
type ConvexClient = Awaited<ReturnType<typeof getConvexClient>>;

const toSceneId = (value: unknown): SceneId | null =>
  typeof value === "string" ? (value as SceneId) : null;

const toClipId = (value: unknown): ClipId | null =>
  typeof value === "string" ? (value as ClipId) : null;

export async function POST(req: Request) {
  try {
    const {
      videoUrl,
      audioUrl,
      syncMode = "cut_off",
      temperature = 0.5,
      activeSpeaker = false,
      sceneId,
      clipId,
    } = await req.json();

    if (typeof videoUrl !== "string" || typeof audioUrl !== "string") {
      return NextResponse.json(
        { error: "Video and audio URLs are required" },
        { status: 400 },
      );
    }

    const prediction = await startLipSyncPrediction({
      videoUrl,
      audioUrl,
      syncMode,
      temperature,
      activeSpeaker,
    });

    const resolvedSceneId = toSceneId(sceneId);
    const resolvedClipId = toClipId(clipId);
    let convexPromise: Promise<ConvexClient> | null = null;

    const getConvex = async (): Promise<ConvexClient> => {
      if (!convexPromise) {
        convexPromise = getConvexClient();
      }
      return convexPromise;
    };

    if (resolvedSceneId) {
      try {
        const convex = await getConvex();
        await convex.mutation(api.video.saveLipsyncPrediction, {
          sceneId: resolvedSceneId,
          predictionId: prediction.id,
        });
      } catch (convexError) {
        console.error(
          "Failed to persist lip sync prediction for scene:",
          convexError,
        );
      }
    }

    if (resolvedClipId) {
      try {
        const convex = await getConvex();
        await convex.mutation(api.video.updateVideoClipLipsync, {
          clipId: resolvedClipId,
          originalVideoUrl: videoUrl,
          hasLipsync: false,
        });
      } catch (convexError) {
        console.error(
          "Failed to persist lip sync metadata for clip:",
          convexError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      predictionId: prediction.id,
      status: prediction.status,
    });
  } catch (error) {
    console.error("Lip sync error:", error);
    return NextResponse.json(
      {
        error: "Failed to start lip sync",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
