import { NextResponse } from "next/server";
import Replicate from "replicate";
import {
  selectImageModel,
  getSelectedModelConfig,
} from "@/lib/select-image-model";
import {
  FALLBACK_IMAGE_MODEL,
  DEFAULT_IMAGE_MODEL,
  getImageModel,
} from "@/lib/image-models";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { visualPrompt, responses, modelKey } = await req.json();

    if (!visualPrompt || typeof visualPrompt !== "string") {
      return NextResponse.json(
        { error: "Visual prompt is required" },
        { status: 400 },
      );
    }

    // Select model: explicit override > from responses > default
    let selectedModelKey: string;
    let modelConfig;

    if (modelKey && getImageModel(modelKey)) {
      // Explicit model override provided
      selectedModelKey = modelKey;
      modelConfig = getImageModel(modelKey);
      console.log(`Using explicitly requested model: ${modelConfig.name}`);
    } else if (responses) {
      // Infer from responses
      selectedModelKey = selectImageModel(responses);
      modelConfig = getSelectedModelConfig(responses);
      console.log(`Selected model from responses: ${modelConfig.name}`);
    } else {
      // Default: no responses provided
      selectedModelKey = DEFAULT_IMAGE_MODEL;
      modelConfig = getImageModel(DEFAULT_IMAGE_MODEL);
      console.log(`Using default model: ${modelConfig.name}`);
    }

    console.log(
      `Regenerating scene with ${modelConfig.name} (cost: ~$${modelConfig.estimatedCost})`,
    );

    // Generate new image using selected model
    const output = await replicate.run(modelConfig.id, {
      input: {
        prompt: visualPrompt,
      },
    });

    // Get the image URL from Replicate
    let imageUrl: string;

    // Handle FileOutput object (has .url() method)
    if (
      output &&
      typeof output === "object" &&
      "url" in output &&
      typeof (output as any).url === "function"
    ) {
      imageUrl = (output as any).url();
    }
    // Handle array of FileOutput objects
    else if (Array.isArray(output) && output.length > 0) {
      const firstOutput = output[0];
      if (
        typeof firstOutput === "object" &&
        "url" in firstOutput &&
        typeof firstOutput.url === "function"
      ) {
        imageUrl = firstOutput.url();
      } else if (typeof firstOutput === "string") {
        imageUrl = firstOutput;
      } else {
        throw new Error(
          `Unexpected array item format: ${JSON.stringify(firstOutput)}`,
        );
      }
    }
    // Handle plain string
    else if (typeof output === "string") {
      imageUrl = output;
    }
    // Handle object with url property (not a function)
    else if (
      output &&
      typeof output === "object" &&
      "url" in output &&
      typeof (output as any).url === "string"
    ) {
      imageUrl = (output as any).url;
    } else {
      console.error("Unexpected output:", output);
      throw new Error(`Unexpected output format: ${typeof output}`);
    }

    console.log("Regenerated image URL:", imageUrl);

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error("Error regenerating scene:", error);
    return NextResponse.json(
      {
        error: "Failed to regenerate scene",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
