import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import {
  STORYBOARD_SYSTEM_PROMPT,
  buildStoryboardPrompt,
} from "@/lib/prompts";
import {
  selectImageModel,
  getSelectedModelConfig,
  explainModelSelection,
} from "@/lib/select-image-model";
import { FALLBACK_IMAGE_MODEL, getImageModel } from "@/lib/image-models";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// Zod schema for scene descriptions
const sceneSchema = z.object({
  scenes: z
    .array(
      z.object({
        sceneNumber: z.number(),
        description: z.string(),
        visualPrompt: z.string(), // Enhanced prompt for image generation
        duration: z.number(), // Duration in seconds
      }),
    )
    .min(3)
    .max(5),
});

export async function POST(req: Request) {
  try {
    const { prompt, responses } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 },
      );
    }

    // Step 2: Generate scene descriptions using OpenAI
    const { object: sceneData } = await generateObject({
      model: openai("gpt-4o"),
      schema: sceneSchema,
      system: STORYBOARD_SYSTEM_PROMPT,
      prompt: buildStoryboardPrompt(prompt, responses),
    });

    // Step 3: Select optimal image generation model
    console.log("\n" + "=".repeat(80));
    console.log("🔍 MODEL SELECTION DEBUG");
    console.log("=".repeat(80));
    console.log("Questionnaire responses received:");
    console.log(JSON.stringify(responses, null, 2));

    const selectedModelKey = selectImageModel(responses);
    const modelConfig = getSelectedModelConfig(responses);
    const modelSelection = explainModelSelection(responses);

    console.log("\n✅ Model Selection Result:");
    console.log(`   Model: ${modelConfig.name} (${selectedModelKey})`);
    console.log(`   Reason: ${modelSelection.reason}`);
    console.log(`   Cost: ~$${modelConfig.estimatedCost}/image`);
    console.log(`   Quality: ${modelConfig.quality}, Speed: ${modelConfig.speed}`);
    console.log("=".repeat(80) + "\n");

    // Step 4: Generate images using selected model
    const scenesWithImages = await Promise.all(
      sceneData.scenes.map(async (scene) => {
        try {
          // Call Replicate with dynamically selected model
          const output = await replicate.run(modelConfig.id, {
            input: {
              prompt: scene.visualPrompt,
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
          }
          // Handle object with output property
          else if (output && typeof output === "object" && "output" in output) {
            const outputData = (output as any).output;
            if (Array.isArray(outputData) && outputData.length > 0) {
              imageUrl = outputData[0];
            } else if (typeof outputData === "string") {
              imageUrl = outputData;
            } else {
              throw new Error(
                `Unexpected output.output format: ${JSON.stringify(outputData)}`,
              );
            }
          } else {
            console.error("Unexpected output:", output);
            throw new Error(`Unexpected output format: ${typeof output}`);
          }

          console.log(`Scene ${scene.sceneNumber} image URL:`, imageUrl);

          // TODO: Future enhancement - upload to Convex storage
          // const imageResponse = await fetch(imageUrl);
          // const imageBlob = await imageResponse.blob();
          // Upload blob to Convex storage for permanent hosting

          return {
            sceneNumber: scene.sceneNumber,
            description: scene.description,
            imageUrl: imageUrl,
            duration: scene.duration,
            replicateImageId: undefined, // Could extract from output metadata if needed
          };
        } catch (error) {
          console.error(
            `Error generating image for scene ${scene.sceneNumber} with ${modelConfig.name}:`,
            error,
          );

          // Fallback: Try with backup model
          if (selectedModelKey !== FALLBACK_IMAGE_MODEL) {
            console.log(
              `Retrying scene ${scene.sceneNumber} with fallback model...`,
            );
            try {
              const fallbackModel = getImageModel(FALLBACK_IMAGE_MODEL);
              const fallbackOutput = await replicate.run(fallbackModel.id, {
                input: {
                  prompt: scene.visualPrompt,
                },
              });

              // Extract URL from fallback output
              let fallbackImageUrl: string;
              if (
                fallbackOutput &&
                typeof fallbackOutput === "object" &&
                "url" in fallbackOutput &&
                typeof (fallbackOutput as any).url === "function"
              ) {
                fallbackImageUrl = (fallbackOutput as any).url();
              } else if (
                Array.isArray(fallbackOutput) &&
                fallbackOutput.length > 0
              ) {
                fallbackImageUrl =
                  typeof fallbackOutput[0] === "string"
                    ? fallbackOutput[0]
                    : fallbackOutput[0].url();
              } else if (typeof fallbackOutput === "string") {
                fallbackImageUrl = fallbackOutput;
              } else {
                throw new Error("Fallback also failed");
              }

              console.log(
                `Scene ${scene.sceneNumber} generated with fallback model`,
              );
              return {
                sceneNumber: scene.sceneNumber,
                description: scene.description,
                imageUrl: fallbackImageUrl,
                duration: scene.duration,
                replicateImageId: undefined,
              };
            } catch (fallbackError) {
              console.error(
                `Fallback also failed for scene ${scene.sceneNumber}:`,
                fallbackError,
              );
            }
          }

          // Return scene without image if both primary and fallback fail
          return {
            sceneNumber: scene.sceneNumber,
            description: scene.description,
            imageUrl: undefined,
            duration: scene.duration,
            replicateImageId: undefined,
          };
        }
      }),
    );

    return NextResponse.json({
      success: true,
      scenes: scenesWithImages,
      modelInfo: {
        modelKey: selectedModelKey,
        modelName: modelConfig.name,
        estimatedCost: modelConfig.estimatedCost,
        reason: modelSelection.reason,
      },
    });
  } catch (error) {
    console.error("Error generating storyboard:", error);
    return NextResponse.json(
      {
        error: "Failed to generate storyboard",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
