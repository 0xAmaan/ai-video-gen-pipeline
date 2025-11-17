import { NextResponse } from "next/server";
import Replicate from "replicate";
import { IMAGE_TO_VIDEO_MODELS } from "@/lib/types/models";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { scenes, videoModel } = await req.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "Scenes array is required" },
        { status: 400 },
      );
    }

    // Get the video model configuration
    const modelKey = videoModel || "wan-video/wan-2.5-i2v-fast";
    const modelConfig = IMAGE_TO_VIDEO_MODELS.find(model => model.id === modelKey);

    if (!modelConfig) {
      return NextResponse.json(
        { error: `Invalid video model: ${modelKey}` },
        { status: 400 },
      );
    }

    console.log(`Starting ${scenes.length} video clip predictions using ${modelConfig.name}...`);

    const clampDuration = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const snapToClosest = (value: number, allowed: number[]): number => {
      return allowed.reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
      );
    };

    // Create all predictions in parallel (don't wait for completion)
    const predictionPromises = scenes.map(async (scene: any, index: number) => {
      try {
        if (!scene.imageUrl) {
          throw new Error(`Scene ${index + 1} has no image URL`);
        }

        console.log(`Creating prediction for scene ${scene.sceneNumber} with ${modelConfig.name}...`);

        // Determine requested duration from storyboard slider (default to modelConfig.defaultDuration or 5)
        const requestedDurationRaw =
          typeof scene.duration === "number" && scene.duration > 0
            ? scene.duration
            : modelConfig.defaultDuration || 5;

        // Clamp to 1–10 seconds as per UI slider
        let effectiveDuration = clampDuration(
          Math.round(requestedDurationRaw),
          1,
          10,
        );

        // Apply model-specific duration constraints
        if (modelKey.includes("google/veo-3.1")) {
          // Veo 3.1 & Veo 3.1 Fast support only 4, 6, and 8 second clips
          effectiveDuration = snapToClosest(effectiveDuration, [4, 6, 8]);
        } else if (modelKey.includes("minimax/hailuo-2.3-fast")) {
          // Hailuo supports 6-second videos
          effectiveDuration = 6;
        } else if (
          modelKey.includes("wan-video") ||
          modelKey.includes("seedance") ||
          modelKey.includes("kling")
        ) {
          // WAN 2.5, SeéDance, and Kling currently support 5-second clips
          effectiveDuration = 5;
        } else if (modelConfig.defaultDuration) {
          // Fallback to model's default if defined
          effectiveDuration = modelConfig.defaultDuration;
        }

        // Prepare input based on model requirements (following PRD WAN-style template)
        const input: any = {
          image: scene.imageUrl,
          prompt: (scene.visualPrompt || scene.description) + ", cinematic, smooth motion, professional video",
        };

        // Add common parameters
        if (modelConfig.supportedResolutions?.includes("720p")) {
          if (modelKey.includes("hailuo")) {
            // Hailuo uses different resolution names
            input.resolution = "768p";
          } else {
            input.resolution = "720p";
          }
        }

        // Apply duration to model input when supported
        if (modelConfig.defaultDuration || typeof scene.duration === "number") {
          input.duration = effectiveDuration;
        }

        // Add WAN-specific parameters
        if (modelKey.includes("wan-video")) {
          input.negative_prompt = "blur, distortion, jitter, artifacts, low quality";
          input.prompt_expansion = true;
        }

        // Add Google Veo specific parameters
        if (modelKey.includes("google/veo")) {
          input.aspect_ratio = "16:9";
          input.generate_audio = false; // We handle audio separately
          if (!modelKey.includes("fast")) {
            input.negative_prompt = "blur, distortion, jitter, artifacts, low quality";
          }
        }

        // Add SeéDance specific parameters
        if (modelKey.includes("seedance")) {
          input.aspect_ratio = "16:9";
          input.fps = 24;
          if (modelKey.includes("lite")) {
            input.camera_fixed = false;
          }
        }

        // Add Kling specific parameters
        if (modelKey.includes("kling")) {
          input.aspect_ratio = "16:9";
          input.negative_prompt = "blur, distortion, jitter, artifacts, low quality";
          input.start_image = scene.imageUrl; // Kling uses start_image instead of image
          delete input.image;
        }

        // Add Hailuo specific parameters
        if (modelKey.includes("hailuo")) {
          input.first_frame_image = scene.imageUrl; // Hailuo uses first_frame_image
          delete input.image;
          input.prompt_optimizer = true;
        }

        // Create prediction without waiting for completion
        const prediction = await replicate.predictions.create({
          model: modelConfig.modelPath,
          input,
        });

        console.log(
          `Prediction created for scene ${scene.sceneNumber}: ${prediction.id}`,
        );

        return {
          sceneNumber: scene.sceneNumber,
          sceneId: scene.id,
          predictionId: prediction.id,
          status: "pending",
          duration: effectiveDuration,
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
          duration: effectiveDuration,
        };
      }
    });

    // Wait for all predictions to be created
    const predictions = await Promise.all(predictionPromises);

    const successfulPredictions = predictions.filter((p) => p.predictionId);
    const failedPredictions = predictions.filter((p) => !p.predictionId);

    console.log(
      `Predictions created: ${successfulPredictions.length}/${predictions.length} successful`,
    );

    return NextResponse.json({
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
    return NextResponse.json(
      {
        error: "Failed to create video predictions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
