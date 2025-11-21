import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { startLipSyncPrediction } from "@/lib/server/lipsync";
import { apiResponse, apiError } from "@/lib/api-response";

type SceneId = Id<"scenes">;
type ClipId = Id<"videoClips">;
type ConvexClient = Awaited<ReturnType<typeof getConvexClient>>;

interface LipsyncClipInput {
  sceneId?: string;
  clipId?: string;
  videoUrl?: string;
  narrationUrl?: string;
  syncMode?: string;
  temperature?: number;
  activeSpeaker?: boolean;
}

const toSceneId = (value: unknown): SceneId | null =>
  typeof value === "string" ? (value as SceneId) : null;

const toClipId = (value: unknown): ClipId | null =>
  typeof value === "string" ? (value as ClipId) : null;

export async function POST(req: Request) {
  try {
    const { clips } = await req.json();

    if (!Array.isArray(clips) || clips.length === 0) {
      return apiError("clips array is required", 400);
    }

    let convexPromise: Promise<ConvexClient> | null = null;
    const getConvex = async (): Promise<ConvexClient> => {
      if (!convexPromise) {
        convexPromise = getConvexClient();
      }
      return convexPromise;
    };

    const results: Array<{
      sceneId: string | null;
      clipId: string | null;
      predictionId: string | null;
      status: string;
      error?: string;
    }> = [];

    for (const clip of clips as LipsyncClipInput[]) {
      const sceneIdString =
        typeof clip.sceneId === "string" ? clip.sceneId : null;
      const clipIdString =
        typeof clip.clipId === "string" ? clip.clipId : null;
      const resolvedSceneId = toSceneId(clip.sceneId);
      const resolvedClipId = toClipId(clip.clipId);

      if (!clip?.videoUrl || !clip?.narrationUrl) {
        results.push({
          sceneId: sceneIdString,
          clipId: clipIdString,
          predictionId: null,
          status: "skipped",
          error: "Missing video or narration URL",
        });
        continue;
      }

      try {
        const prediction = await startLipSyncPrediction({
          videoUrl: clip.videoUrl,
          audioUrl: clip.narrationUrl,
          syncMode: clip.syncMode,
          temperature: clip.temperature,
          activeSpeaker: clip.activeSpeaker,
        });

        if (resolvedSceneId) {
          try {
            const convex = await getConvex();
            await convex.mutation(api.video.saveLipsyncPrediction, {
              sceneId: resolvedSceneId,
              predictionId: prediction.id,
            });
          } catch (convexError) {
            console.error(
              "Failed to persist scene lipsync prediction:",
              convexError,
            );
          }
        }

        if (resolvedClipId) {
          try {
            const convex = await getConvex();
            await convex.mutation(api.video.updateVideoClipLipsync, {
              clipId: resolvedClipId,
              status: "processing",
              lipsyncVideoUrl: clip.videoUrl ?? undefined,
              hasLipsync: false,
            });
          } catch (convexError) {
            console.error(
              "Failed to persist clip lipsync metadata:",
              convexError,
            );
          }
        }

        results.push({
          sceneId: sceneIdString,
          clipId: clipIdString,
          predictionId: prediction.id,
          status: prediction.status,
        });
      } catch (predictionError) {
        console.error("Failed to start lip sync for clip:", predictionError);
        results.push({
          sceneId: sceneIdString,
          clipId: clipIdString,
          predictionId: null,
          status: "error",
          error:
            predictionError instanceof Error
              ? predictionError.message
              : "Unknown error",
        });
      }
    }

    const successful = results.filter((result) => result.predictionId);

    return apiResponse({
      success: successful.length === results.length,
      predictions: results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: results.length - successful.length,
      },
    });
  } catch (error) {
    console.error("Failed to queue lipsync clips:", error);
    return apiError(
      "Failed to queue lip sync predictions",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
