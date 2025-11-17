import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import {
  extractLipsyncVideoUrl,
  getLipSyncPrediction,
  mapReplicateStatusToLipsync,
} from "@/lib/server/lipsync";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { mockLipsyncResult } from "@/lib/demo-mocks";
import { apiResponse, apiError } from "@/lib/api-response";

type SceneId = Id<"scenes">;
type ClipId = Id<"videoClips">;

const toSceneId = (value: unknown): SceneId | null =>
  typeof value === "string" ? (value as SceneId) : null;

const toClipId = (value: unknown): ClipId | null =>
  typeof value === "string" ? (value as ClipId) : null;

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

  try {
    const { predictionId, sceneId, clipId } = await req.json();

    // Get demo mode from headers
    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost";

    // Track API call
    flowTracker.trackAPICall("POST", "/api/poll-lipsync", {
      predictionId,
      demoMode,
    });

    if (typeof predictionId !== "string" || predictionId.length === 0) {
      return apiError("predictionId is required", 400);
    }

    // If no-cost mode and it's a mock prediction, return instant complete
    if (shouldMock && predictionId.startsWith("mock-")) {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Returning instant mock lip-sync status - zero API costs",
      );
      const mockResult = mockLipsyncResult();
      return apiResponse({
        status: mockResult.status,
        lipsyncStatus: "complete",
        lipsyncVideoUrl: mockResult.videoUrl,
        error: null,
      });
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

    return apiResponse({
      status: prediction.status,
      lipsyncStatus,
      lipsyncVideoUrl,
      error: prediction.error ?? null,
    });
  } catch (error) {
    console.error("Failed to poll lipsync prediction:", error);
    return apiError(
      "Failed to poll lip sync status",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
