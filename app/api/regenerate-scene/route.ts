import Replicate from "replicate";
import { IMAGE_MODELS } from "@/lib/image-models";
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { mockReplicatePrediction, mockDelay } from "@/lib/demo-mocks";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const { visualPrompt, responses, style, imageModel } = await req.json();

    flowTracker.trackAPICall("POST", "/api/regenerate-scene", {
      visualPrompt: visualPrompt?.slice(0, 50),
      style,
      demoMode,
    });

    if (!visualPrompt || typeof visualPrompt !== "string") {
      return apiError("Visual prompt is required", 400);
    }

    // Demo mode: Return mock image instantly
    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock image generation - zero API costs",
      );
      await mockDelay(500);
      const mockPrediction = mockReplicatePrediction("image");
      return apiResponse({
        success: true,
        imageUrl: mockPrediction.output,
      });
    }

    // Use provided model or default to leonardo-phoenix
    const modelKey = imageModel || "leonardo-phoenix";
    const modelConfig =
      IMAGE_MODELS[modelKey] || IMAGE_MODELS["leonardo-phoenix"];

    console.log(
      `Regenerating scene with model: ${modelConfig.name} (${modelKey})`,
    );

    // Select style based on responses or use provided style (only applies to Leonardo Phoenix)
    let phoenixStyle = style || "cinematic";
    const isLeonardoPhoenix = modelKey === "leonardo-phoenix";

    if (isLeonardoPhoenix && !style && responses && responses["visual-style"]) {
      const visualStyle = responses["visual-style"].toLowerCase();
      if (
        visualStyle.includes("documentary") ||
        visualStyle.includes("black and white")
      ) {
        phoenixStyle = "pro_bw_photography";
      } else if (
        visualStyle.includes("cinematic") ||
        visualStyle.includes("film")
      ) {
        phoenixStyle = "cinematic";
      } else if (
        visualStyle.includes("photo") ||
        visualStyle.includes("realistic")
      ) {
        phoenixStyle = "pro_color_photography";
      } else if (
        visualStyle.includes("animated") ||
        visualStyle.includes("cartoon")
      ) {
        phoenixStyle = "illustration";
      } else if (
        visualStyle.includes("vintage") ||
        visualStyle.includes("retro")
      ) {
        phoenixStyle = "pro_film_photography";
      }
    }

    console.log(
      `Regenerating scene with ${modelConfig.name} (${modelKey})${isLeonardoPhoenix ? ` (style: ${phoenixStyle})` : ""}`,
    );

    flowTracker.trackDecision(
      "Image model selection",
      modelConfig.name,
      `Using ${modelConfig.name} for scene regeneration`,
    );

    // Prepare input parameters based on model
    const input: any = {
      prompt: visualPrompt,
      aspect_ratio: "16:9",
      num_images: 1,
    };

    // Add Leonardo Phoenix specific parameters
    if (isLeonardoPhoenix) {
      input.generation_mode = "quality";
      input.contrast = "medium";
      input.prompt_enhance = false;
      input.style = phoenixStyle;
    }

    // Add FLUX specific parameters
    if (modelConfig.id.includes("flux")) {
      input.num_outputs = 1;
      if (modelConfig.id.includes("schnell")) {
        input.num_inference_steps = 4;
      }
    }

    // Add SDXL specific parameters
    if (modelConfig.id.includes("sdxl")) {
      input.num_inference_steps = 25;
      input.guidance_scale = 7.5;
    }

    // Add consistent-character specific parameters
    if (modelConfig.id.includes("consistent-character")) {
      input.guidance_scale = 7.5;
      input.num_inference_steps = 50;
      input.seed = -1;
    }

    const output = await replicate.run(
      modelConfig.id as `${string}/${string}`,
      {
        input,
      },
    );

    // Extract image URL from output
    let imageUrl: string;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl =
        typeof output[0] === "string"
          ? output[0]
          : (output[0] as any).url?.() || output[0];
    } else if (typeof output === "string") {
      imageUrl = output;
    } else {
      throw new Error(`Unexpected output format: ${typeof output}`);
    }

    return apiResponse({
      success: true,
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error("Error regenerating scene:", error);
    return apiError(
      "Failed to regenerate scene",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
