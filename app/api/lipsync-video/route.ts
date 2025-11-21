import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { startLipSyncPrediction } from "@/lib/server/lipsync";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { mockReplicatePrediction, mockDelay } from "@/lib/demo-mocks";
import { apiResponse, apiError } from "@/lib/api-response";

type SceneId = Id<"scenes">;
type ClipId = Id<"videoClips">;
type ConvexClient = Awaited<ReturnType<typeof getConvexClient>>;

const toSceneId = (value: unknown): SceneId | null =>
  typeof value === "string" ? (value as SceneId) : null;

const toClipId = (value: unknown): ClipId | null =>
  typeof value === "string" ? (value as ClipId) : null;

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

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

    // Get demo mode from headers
    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost";

    // Track API call
    flowTracker.trackAPICall("POST", "/api/lipsync-video", {
      sceneId,
      clipId,
      demoMode,
    });

    if (typeof videoUrl !== "string" || typeof audioUrl !== "string") {
      return apiError("Video and audio URLs are required", 400);
    }

    // If no-cost mode, return instant mock prediction
    if (shouldMock) {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock lip-sync - zero API costs",
      );
      await mockDelay(50);
      const mockPrediction = mockReplicatePrediction("lipsync");
      return apiResponse({
        success: true,
        predictionId: mockPrediction.id,
        status: mockPrediction.status,
      });
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
          hasLipsync: false,
          status: "processing",
        });
      } catch (convexError) {
        console.error(
          "Failed to persist lip sync metadata for clip:",
          convexError,
        );
      }
    }

    return apiResponse({
      success: true,
      predictionId: prediction.id,
      status: prediction.status,
    });
  } catch (error) {
    console.error("Lip sync error:", error);
    return apiError(
      "Failed to start lip sync",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
