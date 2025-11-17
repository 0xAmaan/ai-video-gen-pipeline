import Replicate from "replicate";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders, getModelConfig } from "@/lib/demo-mode";
import { mockReplicatePrediction, mockDelay } from "@/lib/demo-mocks";
import { apiResponse, apiError } from "@/lib/api-response";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const startTime = Date.now();

  try {
    const { scenes } = await req.json();

    // Get demo mode from headers (passed from client)
    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost";
    const shouldUseCheap = demoMode === "cheap";

    // Track API call
    flowTracker.trackAPICall("POST", "/api/generate-all-clips", {
      sceneCount: scenes?.length,
      demoMode,
    });

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return apiError("Scenes array is required", 400);
    }

    // Track demo mode decision
    if (demoMode !== "off") {
      flowTracker.trackDecision(
        "Check demo mode",
        demoMode,
        `Using ${demoMode} mode for video generation`,
      );
    }

    // Track model selection
    const modelConfig = getModelConfig();
    if (modelConfig.enabled && modelConfig.models?.video) {
      flowTracker.trackModelSelection(
        modelConfig.models.video.name,
        modelConfig.models.video.version,
        modelConfig.models.video.cost,
        shouldUseCheap
          ? "Using cheaper/faster model for development"
          : "Using production-quality model",
      );
    }

    // Create all predictions in parallel (don't wait for completion)
    const predictionPromises = scenes.map(async (scene: any, index: number) => {
      try {
        if (!scene.imageUrl) {
          throw new Error(`Scene ${index + 1} has no image URL`);
        }

        // Round duration to nearest valid value (5 or 10)
        const validDuration = scene.duration <= 7.5 ? 5 : 10;

        // Check if we should use mock data (no-cost mode)
        let prediction;
        if (shouldMock) {
          flowTracker.trackDecision(
            "Use mock prediction",
            "true",
            "No-cost mode active - using mock data",
          );
          await mockDelay(50); // Simulate minimal processing time
          prediction = mockReplicatePrediction("video");
        } else {
          // Create prediction without waiting for completion
          const predictionStart = Date.now();
          prediction = await replicate.predictions.create({
            version:
              "66226b38d223f8ac7a81aa33b8519759e300c2f9818a215e32900827ad6d2db5", // WAN 2.5 i2v Fast (latest)
            input: {
              image: scene.imageUrl,
              // Use the detailed visualPrompt (150-250 words) if available, otherwise fallback to description
              prompt:
                (scene.visualPrompt || scene.description) +
                ", cinematic, smooth motion, professional video",
              duration: validDuration,
              resolution: "720p",
              negative_prompt:
                "blur, distortion, jitter, artifacts, low quality",
              prompt_expansion: true,
            },
          });

          flowTracker.trackTiming(
            `Replicate create prediction (scene ${scene.sceneNumber})`,
            Date.now() - predictionStart,
            predictionStart,
          );
        }

        return {
          sceneNumber: scene.sceneNumber,
          sceneId: scene.id,
          predictionId: prediction.id,
          status: "pending",
          duration: scene.duration || 5,
        };
      } catch (error) {
        console.error(
          `Error creating prediction for scene ${scene.sceneNumber}:`,
          error,
        );
        return {
          sceneNumber: scene.sceneNumber,
          sceneId: scene.id,
          predictionId: null,
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          duration: scene.duration || 5,
        };
      }
    });

    // Wait for all predictions to be created
    const predictions = await Promise.all(predictionPromises);

    const successfulPredictions = predictions.filter((p) => p.predictionId);
    const failedPredictions = predictions.filter((p) => !p.predictionId);

    // Track total operation timing
    flowTracker.trackTiming(
      "Total video clip generation request",
      Date.now() - startTime,
      startTime,
    );

    return apiResponse({
      success: failedPredictions.length === 0,
      predictions: predictions,
      summary: {
        total: predictions.length,
        successful: successfulPredictions.length,
        failed: failedPredictions.length,
      },
    });
  } catch (error) {
    console.error("Error creating video predictions:", error);
    return apiError(
      "Failed to create video predictions",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
