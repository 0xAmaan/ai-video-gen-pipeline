import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import {
  extractLipsyncVideoUrl,
  getLipSyncPrediction,
  mapReplicateStatusToLipsync,
} from "@/lib/server/lipsync";

type SceneId = Id<"scenes">;
type ClipId = Id<"videoClips">;

const toSceneId = (value: unknown): SceneId | null =>
  typeof value === "string" ? (value as SceneId) : null;

const toClipId = (value: unknown): ClipId | null =>
  typeof value === "string" ? (value as ClipId) : null;

export async function POST(req: Request) {
  try {
    const { predictionId, sceneId, clipId } = await req.json();

    if (typeof predictionId !== "string" || predictionId.length === 0) {
      return NextResponse.json(
        { error: "predictionId is required" },
        { status: 400 },
      );
    }

    const prediction = await getLipSyncPrediction(predictionId);
    const lipsyncVideoUrl = extractLipsyncVideoUrl(prediction.output);
    const lipsyncStatus = mapReplicateStatusToLipsync(prediction.status);
    const resolvedSceneId = toSceneId(sceneId);
    const resolvedClipId = toClipId(clipId);

    if (
      (resolvedSceneId || resolvedClipId) &&
      (lipsyncStatus === "complete" || lipsyncStatus === "failed")
    ) {
      try {
        const convex = await getConvexClient();
        if (resolvedSceneId) {
          await convex.mutation(api.video.updateSceneLipsync, {
            sceneId: resolvedSceneId,
            lipsyncStatus,
            lipsyncVideoUrl:
              lipsyncStatus === "complete" && lipsyncVideoUrl
                ? lipsyncVideoUrl
                : undefined,
          });
        }
        if (resolvedClipId) {
          await convex.mutation(api.video.updateVideoClipLipsync, {
            clipId: resolvedClipId,
            lipsyncVideoUrl:
              lipsyncStatus === "complete" && lipsyncVideoUrl
                ? lipsyncVideoUrl
                : undefined,
            hasLipsync: lipsyncStatus === "complete",
          });
        }
      } catch (convexError) {
        console.error("Failed to persist lipsync status:", convexError);
      }
    }

    return NextResponse.json({
      status: prediction.status,
      lipsyncStatus,
      lipsyncVideoUrl,
      error: prediction.error ?? null,
    });
  } catch (error) {
    console.error("Failed to poll lipsync prediction:", error);
    return NextResponse.json(
      {
        error: "Failed to poll lip sync status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
