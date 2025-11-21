import Replicate from "replicate";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { mockCharacterVariations, mockDelay } from "@/lib/demo-mocks";
import { apiResponse, apiError } from "@/lib/api-response";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// Model configurations for character reference generation
// Using faster models for quick character selection
const CHARACTER_MODELS = {
  "flux-schnell-1": {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX Schnell v1",
    estimatedCost: 0.003,
  },
  "flux-schnell-2": {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX Schnell v2",
    estimatedCost: 0.003,
  },
  "flux-schnell-3": {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX Schnell v3",
    estimatedCost: 0.003,
  },
};

/**
 * Helper function to call Replicate and extract image URL
 */
async function generateWithModel(
  modelId: string,
  prompt: string,
): Promise<string> {
  const output = await replicate.run(modelId as any, {
    input: { prompt },
  });

  // Handle different output formats from Replicate
  if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as any).url === "function"
  ) {
    return (output as any).url();
  } else if (Array.isArray(output) && output.length > 0) {
    const firstOutput = output[0];
    if (
      typeof firstOutput === "object" &&
      "url" in firstOutput &&
      typeof firstOutput.url === "function"
    ) {
      return firstOutput.url();
    } else if (typeof firstOutput === "string") {
      return firstOutput;
    }
  } else if (typeof output === "string") {
    return output;
  } else if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as any).url === "string"
  ) {
    return (output as any).url;
  } else if (output && typeof output === "object" && "output" in output) {
    const outputData = (output as any).output;
    if (Array.isArray(outputData) && outputData.length > 0) {
      return outputData[0];
    } else if (typeof outputData === "string") {
      return outputData;
    }
  }

  throw new Error(`Unexpected output format from ${modelId}`);
}

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const startTime = Date.now();

  try {
    const { projectId, scenePrompt, responses } = await req.json();

    // Get demo mode from headers
    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost";

    // Track API call
    flowTracker.trackAPICall("POST", "/api/generate-character-variations", {
      projectId,
      demoMode,
    });

    if (!projectId || !scenePrompt) {
      return apiError("Missing required fields", 400);
    }

    // If no-cost mode, return instant mock data
    if (shouldMock) {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock character generation - zero API costs",
      );
      await mockDelay(200);
      const mockVariations = mockCharacterVariations();
      flowTracker.trackTiming(
        "Mock character generation",
        Date.now() - startTime,
        startTime,
      );
      return apiResponse({
        success: true,
        variations: mockVariations.map((v) => ({
          model: v.seed,
          modelName: `Mock Character ${v.id}`,
          imageUrl: v.imageUrl,
          cost: 0,
        })),
        totalCost: 0,
      });
    }

    // Build character prompt that respects user preferences
    let characterPrompt = `Create a detailed character portrait for this video: ${scenePrompt}. `;

    // Incorporate user preferences from questionnaire
    if (responses) {
      // Visual style preferences - be very explicit about the style
      if (responses["visual-style"]) {
        const visualStyle = responses["visual-style"].toLowerCase();
        characterPrompt += `Visual style: ${responses["visual-style"]}. `;

        // Add specific instructions for different styles
        if (
          visualStyle.includes("documentary") ||
          visualStyle.includes("black and white")
        ) {
          characterPrompt +=
            "Black and white photography, documentary style, cinéma vérité, realistic natural lighting, high contrast, grainy film texture, authentic candid composition. ";
        } else if (visualStyle.includes("cinematic")) {
          characterPrompt +=
            "Cinematic lighting, film grain, professional color grading, shallow depth of field. ";
        } else if (
          visualStyle.includes("animated") ||
          visualStyle.includes("cartoon")
        ) {
          characterPrompt +=
            "Illustrated art style, stylized character design, vibrant colors. ";
        } else if (
          visualStyle.includes("vintage") ||
          visualStyle.includes("retro")
        ) {
          characterPrompt +=
            "Vintage aesthetic, retro color palette, film photography style. ";
        }
      }

      if (responses["image-generation-priority"]) {
        const priority = responses["image-generation-priority"];
        if (priority === "photorealism") {
          characterPrompt +=
            "Photorealistic, highly detailed, professional photography. ";
        } else if (priority === "artistic") {
          characterPrompt += "Artistic, stylized, creative interpretation. ";
        } else if (priority === "text-quality") {
          characterPrompt += "Clear, sharp, professional rendering. ";
        }
      }

      // Emotion/mood
      if (responses["primary-emotion"]) {
        characterPrompt += `Character should evoke ${responses["primary-emotion"]} emotion. `;
      }
      if (responses["mood"] || responses["tone"]) {
        const mood = responses["mood"] || responses["tone"];
        characterPrompt += `Overall mood: ${mood}. `;
      }

      // Any other relevant context
      if (responses["target-audience"]) {
        characterPrompt += `Audience: ${responses["target-audience"]}. `;
      }
    }

    characterPrompt +=
      "Focus on the main character with clear, consistent features. Professional quality, well-lit, clear details.";

    // Generate variations with all models in parallel
    const variationPromises = Object.entries(CHARACTER_MODELS).map(
      async ([modelKey, config]) => {
        try {
          const imageUrl = await generateWithModel(config.id, characterPrompt);

          return {
            model: modelKey,
            modelName: config.name,
            imageUrl,
            cost: config.estimatedCost,
          };
        } catch (error) {
          console.error(`❌ ${config.name} failed:`, error);
          // Return error placeholder instead of throwing
          return {
            model: modelKey,
            modelName: config.name,
            imageUrl: "",
            cost: 0,
            error: error instanceof Error ? error.message : "Generation failed",
          };
        }
      },
    );

    const variations = await Promise.all(variationPromises);

    // Filter out failed generations
    const successfulVariations = variations.filter((v) => !("error" in v));
    const failedCount = variations.length - successfulVariations.length;

    if (successfulVariations.length === 0) {
      throw new Error("All model generations failed");
    }

    flowTracker.trackTiming(
      "Total character generation",
      Date.now() - startTime,
      startTime,
    );

    return apiResponse({
      success: true,
      variations: successfulVariations,
      totalCost: successfulVariations.reduce((sum, v) => sum + v.cost, 0),
      failedModels:
        failedCount > 0
          ? variations
              .filter((v) => "error" in v)
              .map((v) => ({ model: v.modelName, error: (v as any).error }))
          : undefined,
    });
  } catch (error) {
    console.error("Error generating character variations:", error);
    return apiError(
      "Failed to generate character variations",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
