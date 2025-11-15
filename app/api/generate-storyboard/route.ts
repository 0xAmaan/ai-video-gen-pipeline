import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import Replicate from "replicate";

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
    const responsesText = responses
      ? Object.entries(responses)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n")
      : "";

    const { object: sceneData } = await generateObject({
      model: openai("gpt-4o"),
      schema: sceneSchema,
      system: `You are an expert storyboard artist and cinematographer. Your job is to break down a video concept into 3-5 compelling visual scenes.

Rules:
- Generate 3-5 scenes that tell a cohesive visual story
- Each scene should have:
  1. A clear description of what's happening
  2. A detailed visual prompt optimized for image generation (include composition, lighting, mood, camera angle, art style)
  3. A suggested duration in seconds (typically 3-8 seconds per scene)
- Visual prompts should be highly descriptive and cinematic
- Include specific details: colors, lighting, composition, mood, camera angles
- Ensure visual continuity and narrative flow between scenes
- Consider the user's specified tone, style, and emotion in the responses

Example scene structure:
{
  "sceneNumber": 1,
  "description": "Opening shot establishing the setting",
  "visualPrompt": "Wide-angle cinematic shot of a modern office lobby at golden hour, warm sunlight streaming through floor-to-ceiling windows, minimalist design with plants, professional atmosphere, shot on ARRI camera, shallow depth of field, photorealistic, 8k quality",
  "duration": 5
}`,
      prompt: `Video concept: "${prompt}"

User preferences:
${responsesText}

Generate 3-5 storyboard scenes that bring this video to life. Make the visual prompts extremely detailed and optimized for AI image generation.`,
    });

    // Step 3: Generate images using Replicate nano-banana
    const scenesWithImages = await Promise.all(
      sceneData.scenes.map(async (scene) => {
        try {
          // Call Replicate to generate image
          const output = await replicate.run("google/nano-banana", {
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

          // Download the image
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`,
            );
          }

          const imageBlob = await imageResponse.blob();

          // Upload to Convex storage
          // Note: We'll need to handle storage upload in a separate mutation
          // For now, we'll just use the Replicate URL directly

          return {
            sceneNumber: scene.sceneNumber,
            description: scene.description,
            imageUrl: imageUrl,
            duration: scene.duration,
            replicateImageId: undefined, // Could extract from output metadata if needed
          };
        } catch (error) {
          console.error(
            `Error generating image for scene ${scene.sceneNumber}:`,
            error,
          );
          // Return scene without image on error
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
