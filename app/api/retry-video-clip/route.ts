import Replicate from "replicate";
import { getFlowTracker } from "@/lib/flow-tracker";
import { apiResponse, apiError } from "@/lib/api-response";
import { IMAGE_TO_VIDEO_MODELS } from "@/lib/types/models";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

  try {
    const {
      sceneId,
      imageUrl,
      description,
      visualPrompt,
      sceneNumber,
      duration,
      videoModel,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/retry-video-clip", {
      sceneId,
      sceneNumber,
    });

    if (!sceneId || typeof sceneId !== "string") {
      return apiError("Scene ID is required", 400);
    }

    if (!imageUrl || typeof imageUrl !== "string") {
      return apiError("Image URL is required", 400);
    }

    // Get the video model configuration
    const modelKey = videoModel || "wan-video/wan-2.5-i2v-fast";
    const modelConfig = IMAGE_TO_VIDEO_MODELS.find(
      (model) => model.id === modelKey,
    );

    if (!modelConfig) {
      return apiError(`Invalid video model: ${modelKey}`, 400);
    }

    flowTracker.trackModelSelection(
      modelConfig.name,
      modelConfig.id,
      undefined,
      `Retrying video generation with ${modelConfig.name}`,
    );

    console.log(
      `Retrying video clip for scene ${sceneNumber} with ${modelConfig.name}...`,
    );

    // Determine duration
    const effectiveDuration = duration || modelConfig.defaultDuration || 5;

    // Prepare input based on model requirements
    const input: any = {
      image: imageUrl,
      prompt:
        (visualPrompt || description) +
        ", cinematic, smooth motion, professional video",
    };

    // Add common parameters
    if (modelConfig.supportedResolutions?.includes("720p")) {
      if (modelKey.includes("hailuo")) {
        input.resolution = "768p";
      } else {
        input.resolution = "720p";
      }
    }

    // Apply duration
    if (modelConfig.defaultDuration || duration) {
      input.duration = effectiveDuration;
    }

    // Add model-specific parameters
    if (modelKey.includes("wan-video")) {
      input.negative_prompt =
        "blur, distortion, jitter, artifacts, low quality";
      input.prompt_expansion = true;
    }

    if (modelKey.includes("google/veo")) {
      input.aspect_ratio = "16:9";
      input.generate_audio = false;
      if (!modelKey.includes("fast")) {
        input.negative_prompt =
          "blur, distortion, jitter, artifacts, low quality";
      }
    }

    if (modelKey.includes("seedance")) {
      input.aspect_ratio = "16:9";
      input.fps = 24;
      if (modelKey.includes("lite")) {
        input.camera_fixed = false;
      }
    }

    if (modelKey.includes("kling")) {
      input.aspect_ratio = "16:9";
      input.negative_prompt =
        "blur, distortion, jitter, artifacts, low quality";
      input.start_image = imageUrl;
      delete input.image;
    }

    if (modelKey.includes("hailuo")) {
      input.first_frame_image = imageUrl;
      delete input.image;
      input.prompt_optimizer = true;
    }

    // Create new prediction
    console.log(`Creating retry prediction with input:`, {
      model: modelConfig.modelPath,
      input,
      sceneNumber,
    });

    const predictionStart = Date.now();
    const prediction = await replicate.predictions.create({
      model: modelConfig.modelPath,
      input,
    });

    flowTracker.trackTiming(
      `Replicate create prediction (retry)`,
      Date.now() - predictionStart,
      predictionStart,
    );

    console.log(
      `Retry prediction created for scene ${sceneNumber}: ${prediction.id}`,
      `Status: ${prediction.status}`,
      prediction.error ? `Error: ${prediction.error}` : "",
    );

    return apiResponse({
      success: true,
      predictionId: prediction.id,
      sceneId,
      duration: effectiveDuration,
    });
  } catch (error) {
    console.error("Error retrying video clip:", error);
    return apiError(
      "Failed to retry video clip",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
