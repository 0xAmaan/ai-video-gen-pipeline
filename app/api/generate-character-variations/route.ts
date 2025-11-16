import { NextResponse } from "next/server";
import Replicate from "replicate";

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
  try {
    const { projectId, scenePrompt, responses } = await req.json();

    if (!projectId || !scenePrompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log("🎨 Generating character variations for:", projectId);
    console.log("📝 Scene prompt:", scenePrompt);
    console.log("📋 User responses:", responses);

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

    console.log("🎭 Character prompt:", characterPrompt);

    // Generate variations with all models in parallel
    const variationPromises = Object.entries(CHARACTER_MODELS).map(
      async ([modelKey, config]) => {
        try {
          console.log(`⏳ Starting ${config.name}...`);
          const imageUrl = await generateWithModel(config.id, characterPrompt);
          console.log(`✅ ${config.name} complete:`, imageUrl);

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

    console.log(
      `✨ Generated ${successfulVariations.length} variations (${failedCount} failed)`,
    );

    return NextResponse.json({
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
    console.error("❌ Error generating character variations:", error);
    return NextResponse.json(
      {
        error: "Failed to generate character variations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
