import Replicate from "replicate";
import { apiResponse, apiError } from "@/lib/api-response";
import { IMAGE_TO_VIDEO_MODELS } from "@/lib/types/models";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const {
      imageUrl,
      prompt,
      duration = 5,
      resolution = "720p",
      videoModel,
    } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return apiError("Image URL is required", 400);
    }

    if (!prompt || typeof prompt !== "string") {
      return apiError("Prompt is required", 400);
    }

    console.log(`Generating video clip: ${prompt.substring(0, 50)}...`);

    // Get the video model configuration
    const modelKey = videoModel || "wan-video/wan-2.5-i2v-fast";
    const modelConfig = IMAGE_TO_VIDEO_MODELS.find(
      (model) => model.id === modelKey,
    );

    if (!modelConfig) {
      return apiError(`Invalid video model: ${modelKey}`, 400);
    }

    console.log(`Using video model: ${modelConfig.name} (${modelKey})`);

    // Prepare input based on model requirements (following PRD WAN-style template)
    const input: any = {
      image: imageUrl,
      prompt: prompt + ", cinematic, smooth motion, professional",
    };

    // Add common parameters
    if (modelConfig.supportedResolutions?.includes(resolution)) {
      if (modelKey.includes("hailuo")) {
        // Hailuo uses different resolution names
        input.resolution = resolution === "720p" ? "768p" : resolution;
      } else {
        input.resolution = resolution;
      }
    }

    if (modelConfig.defaultDuration) {
      input.duration = duration || modelConfig.defaultDuration;
    }

    // Add WAN-specific parameters
    if (modelKey.includes("wan-video")) {
      input.negative_prompt =
        "blur, distortion, jitter, artifacts, low quality";
      input.prompt_expansion = true;
    }

    // Add Google Veo specific parameters
    if (modelKey.includes("google/veo")) {
      input.aspect_ratio = "16:9";
      input.generate_audio = false; // We handle audio separately
      if (!modelKey.includes("fast")) {
        input.negative_prompt =
          "blur, distortion, jitter, artifacts, low quality";
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
      input.negative_prompt =
        "blur, distortion, jitter, artifacts, low quality";
      input.start_image = imageUrl; // Kling uses start_image instead of image
      delete input.image;
    }

    // Add Hailuo specific parameters
    if (modelKey.includes("hailuo")) {
      input.first_frame_image = imageUrl; // Hailuo uses first_frame_image
      delete input.image;
      input.prompt_optimizer = true;
    }

    const output = await replicate.run(
      modelConfig.modelPath as `${string}/${string}`,
      {
        input,
      },
    );

    // Get the video URL from Replicate
    let videoUrl: string;

    // Handle FileOutput object (has .url() method)
    if (
      output &&
      typeof output === "object" &&
      "url" in output &&
      typeof (output as any).url === "function"
    ) {
      videoUrl = (output as any).url();
    }
    // Handle array of FileOutput objects
    else if (Array.isArray(output) && output.length > 0) {
      const firstOutput = output[0];
      if (
        typeof firstOutput === "object" &&
        "url" in firstOutput &&
        typeof firstOutput.url === "function"
      ) {
        videoUrl = firstOutput.url();
      } else if (typeof firstOutput === "string") {
        videoUrl = firstOutput;
      } else {
        throw new Error(
          `Unexpected array item format: ${JSON.stringify(firstOutput)}`,
        );
      }
    }
    // Handle plain string
    else if (typeof output === "string") {
      videoUrl = output;
    }
    // Handle object with url property (not a function)
    else if (
      output &&
      typeof output === "object" &&
      "url" in output &&
      typeof (output as any).url === "string"
    ) {
      videoUrl = (output as any).url;
    } else {
      console.error("Unexpected output:", output);
      throw new Error(`Unexpected output format: ${typeof output}`);
    }

    return apiResponse({
      success: true,
      videoUrl: videoUrl,
    });
  } catch (error) {
    console.error("Error generating video clip:", error);
    return apiError(
      "Failed to generate video clip",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
