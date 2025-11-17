import { generateObject } from "ai";
import { z } from "zod";
import Replicate from "replicate";
import { STORYBOARD_SYSTEM_PROMPT, buildStoryboardPrompt } from "@/lib/prompts";
import { IMAGE_MODELS } from "@/lib/image-models";
import { extractReplicateUrl } from "@/lib/replicate";
import { synthesizeNarrationAudio } from "@/lib/narration";
import { generateVoiceSelection } from "@/lib/server/voice-selection";
import { getConvexClient } from "@/lib/server/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { mockSceneGeneration, mockDelay } from "@/lib/demo-mocks";
import {
  selectImageModel,
  explainModelSelection,
} from "@/lib/select-image-model";
import { apiResponse, apiError } from "@/lib/api-response";
import { createLLMProvider, validateAPIKeys } from "@/lib/server/api-utils";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

async function generateSceneImage(
  scene: GeneratedScene,
  modelConfig: ImageModelConfig,
  style?: string,
) {
  console.log(`🎬 Scene ${scene.sceneNumber}: Using ${modelConfig.name}`);
  console.log(`   Prompt: ${scene.visualPrompt.substring(0, 150)}...`);

  // Prepare input parameters based on model
  const input: any = {
    prompt: scene.visualPrompt,
    aspect_ratio: "16:9",
    num_images: 1,
  };

  // Add Leonardo Phoenix specific parameters
  if (modelConfig.id === "leonardoai/phoenix-1.0") {
    input.generation_mode = "quality";
    input.contrast = "medium";
    input.prompt_enhance = false;
    if (style) {
      input.style = style;
    }
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

  const output = await replicate.run(modelConfig.id as `${string}/${string}`, {
    input,
  });

  const imageUrl = extractReplicateUrl(
    output,
    `scene-${scene.sceneNumber}-image`,
  );

  return imageUrl;
}

// Zod schema for scene descriptions
const sceneSchema = z.object({
  scenes: z
    .array(
      z.object({
        sceneNumber: z.number(),
        description: z.string(),
        visualPrompt: z.string(),
        narrationText: z.string(),
        duration: z.number(),
      }),
    )
    .min(3)
    .max(5),
});

type GeneratedScene = z.infer<typeof sceneSchema>["scenes"][number];
type ImageModelConfig = (typeof IMAGE_MODELS)[keyof typeof IMAGE_MODELS];

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const startTime = Date.now();

  try {
    const { projectId, prompt, responses, imageModel, textModel } =
      await req.json();

    // Get demo mode from headers
    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost";

    // Track API call
    flowTracker.trackAPICall("POST", "/api/generate-storyboard", {
      projectId,
      textModel,
      imageModel,
      demoMode,
    });

    if (!prompt || typeof prompt !== "string") {
      return apiError("Invalid prompt provided", 400);
    }

    if (!projectId || typeof projectId !== "string") {
      return apiError("projectId is required", 400);
    }

    const projectConvexId = projectId as Id<"videoProjects">;

    // If no-cost mode, return instant mock data
    if (shouldMock) {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock storyboard generation - zero API costs",
      );
      await mockDelay(300);
      const mockScenes = mockSceneGeneration(prompt, 3);
      flowTracker.trackTiming(
        "Mock storyboard generation",
        Date.now() - startTime,
        startTime,
      );
      return apiResponse({
        success: true,
        scenes: mockScenes,
        modelInfo: {
          modelKey: "mock-model",
          modelName: "Mock Image Generator",
          style: "mock",
          estimatedCost: 0,
          reason: "Using mock data in no-cost mode",
        },
        voiceSelection: {
          voiceId: "mock-voice-id",
          voiceName: "Mock Voice",
          reasoning: "Mock voice for demo mode",
          emotion: "neutral",
          speed: 1.0,
          pitch: 0,
        },
      });
    }

    // Validate API keys
    const keyValidationError = validateAPIKeys();
    if (keyValidationError) {
      return keyValidationError;
    }

    // Generate scene descriptions using LLM provider (with optional model selection)
    const { provider, providerName } = createLLMProvider(textModel);

    flowTracker.trackDecision(
      "Select text model",
      providerName,
      `Using ${providerName} for scene generation`,
    );

    const { object: sceneData } = await generateObject({
      model: provider,
      schema: sceneSchema,
      system: STORYBOARD_SYSTEM_PROMPT,
      prompt: buildStoryboardPrompt(prompt, responses),
      maxRetries: 3,
    });

    // Step 2: Select voice for narration
    const voiceSelection = await generateVoiceSelection(prompt, responses);

    try {
      const convex = await getConvexClient();
      await convex.mutation(api.video.saveProjectVoiceSettings, {
        projectId: projectConvexId,
        selectedVoiceId: voiceSelection.voiceId,
        selectedVoiceName: voiceSelection.voiceName,
        voiceReasoning: voiceSelection.reasoning,
        emotion: voiceSelection.emotion,
        speed: voiceSelection.speed,
        pitch: voiceSelection.pitch,
      });
    } catch (error) {
      console.warn("Unable to persist voice selection to Convex:", error);
    }

    // Step 3: Select image model
    let modelConfig;
    let phoenixStyle = "cinematic"; // Default style for Phoenix
    let selectedModelKey;

    // If imageModel is explicitly provided, use it
    if (imageModel) {
      selectedModelKey = imageModel;
      modelConfig =
        IMAGE_MODELS[imageModel] || IMAGE_MODELS["leonardo-phoenix"];

      flowTracker.trackDecision(
        "Image model selection",
        "user-specified",
        `Using user-selected model: ${modelConfig.name}`,
      );
    }
    // Check if we're in cheap mode - use FLUX Schnell for speed/cost
    else if (demoMode === "cheap") {
      selectedModelKey = "flux-schnell";
      modelConfig = IMAGE_MODELS["flux-schnell"];

      flowTracker.trackDecision(
        "Image model selection",
        "cheap mode",
        "Using FLUX Schnell for fast/cheap image generation",
      );
    }
    // Real/production mode - use sophisticated selector
    else {
      selectedModelKey = selectImageModel(responses || {});
      modelConfig = IMAGE_MODELS[selectedModelKey];
      const explanation = explainModelSelection(responses || {});

      flowTracker.trackModelSelection(
        modelConfig.name,
        modelConfig.id,
        modelConfig.estimatedCost,
        explanation.reason,
      );
    }

    // Apply Phoenix-specific style if Leonardo Phoenix was selected
    const isLeonardoPhoenix = selectedModelKey === "leonardo-phoenix";
    if (isLeonardoPhoenix && responses && responses["visual-style"]) {
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
      } else if (visualStyle.includes("portrait")) {
        phoenixStyle = "portrait";
      }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log("🔍 IMAGE GENERATION MODEL SELECTION");
    console.log("=".repeat(80));
    console.log(`   Model: ${modelConfig.name}`);
    if (isLeonardoPhoenix) {
      console.log(`   Style: ${phoenixStyle}`);
    }
    console.log(`   Cost: ~$${modelConfig.estimatedCost}/image`);
    console.log(`${"=".repeat(80)}\n`);

    // Step 4 & 5: Generate images and narration in parallel for each scene
    const scenesWithMedia = await Promise.all(
      sceneData.scenes.map(async (scene) => {
        const imagePromise = generateSceneImage(
          scene,
          modelConfig,
          isLeonardoPhoenix ? phoenixStyle : undefined,
        ).catch((error) => {
          console.error(
            `Error generating image for scene ${scene.sceneNumber}:`,
            error,
          );
          return undefined;
        });

        const narrationPromise = synthesizeNarrationAudio({
          text: scene.narrationText,
          voiceId: voiceSelection.voiceId,
          emotion: voiceSelection.emotion,
          speed: voiceSelection.speed,
          pitch: voiceSelection.pitch,
        }).catch((error) => {
          console.error(
            `Error generating narration for scene ${scene.sceneNumber}:`,
            error,
          );
          return null;
        });

        const [imageUrl, narrationResult] = await Promise.all([
          imagePromise,
          narrationPromise,
        ]);

        return {
          sceneNumber: scene.sceneNumber,
          description: scene.description,
          visualPrompt: scene.visualPrompt,
          narrationText: narrationResult?.sanitizedText ?? scene.narrationText,
          narrationUrl: narrationResult?.audioUrl,
          imageUrl,
          duration: scene.duration,
          voiceId: narrationResult?.voiceId ?? voiceSelection.voiceId,
          voiceName: narrationResult?.voiceName ?? voiceSelection.voiceName,
        };
      }),
    );

    flowTracker.trackTiming(
      "Total storyboard generation",
      Date.now() - startTime,
      startTime,
    );

    return apiResponse({
      success: true,
      scenes: scenesWithMedia,
      modelInfo: {
        modelKey: selectedModelKey,
        modelName: modelConfig.name,
        style: phoenixStyle,
        estimatedCost: modelConfig.estimatedCost,
        reason: imageModel
          ? `Using user-selected ${modelConfig.name}`
          : demoMode === "cheap"
            ? `Using FLUX Schnell for fast/cheap development mode`
            : `Selected ${modelConfig.name}${phoenixStyle ? ` (${phoenixStyle})` : ""} based on project preferences.`,
      },
      voiceSelection,
    });
  } catch (error) {
    console.error("Error generating storyboard:", error);
    return apiError(
      "Failed to generate storyboard",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
