import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { STORYBOARD_SYSTEM_PROMPT, buildStoryboardPrompt } from "@/lib/prompts";
import { IMAGE_MODELS } from "@/lib/image-models";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
        visualPrompt: z.string(),
        duration: z.number(),
      }),
    )
    .min(3)
    .max(5),
});

export async function POST(req: Request) {
  try {
    const { projectId, prompt, responses } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 },
      );
    }

    // Step 1: Generate scene descriptions using Groq
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (!hasGroqKey && !hasOpenAIKey) {
      console.error(
        "❌ No API keys found! Set GROQ_API_KEY or OPENAI_API_KEY in .env.local",
      );
      return NextResponse.json(
        {
          error: "No API keys configured",
          details:
            "Please set GROQ_API_KEY or OPENAI_API_KEY in your .env.local file",
        },
        { status: 500 },
      );
    }

    const modelToUse = hasGroqKey
      ? groq("openai/gpt-oss-20b")
      : openai("gpt-4o-mini");

    console.log(
      `🔧 Scene generation model: ${hasGroqKey ? "Groq (gpt-oss-20b) - FAST ⚡" : "OpenAI (gpt-4o-mini) - SLOWER 🐌"}`,
    );

    const { object: sceneData } = await generateObject({
      model: modelToUse,
      schema: sceneSchema,
      system: STORYBOARD_SYSTEM_PROMPT,
      prompt: buildStoryboardPrompt(prompt, responses),
      maxRetries: 3,
    });

    // Step 2: Select style for Leonardo Phoenix
    console.log("\n" + "=".repeat(80));
    console.log("🔍 LEONARDO PHOENIX MODEL SELECTION");
    console.log("=".repeat(80));

    const modelConfig = IMAGE_MODELS["leonardo-phoenix"];
    let phoenixStyle = "cinematic"; // Default style

    if (responses && responses["visual-style"]) {
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

    console.log(`   Model: ${modelConfig.name}`);
    console.log(`   Style: ${phoenixStyle}`);
    console.log(`   Cost: ~$${modelConfig.estimatedCost}/image`);
    console.log("=".repeat(80) + "\n");

    // Step 3: Generate images using Leonardo Phoenix via Replicate
    const scenesWithImages = await Promise.all(
      sceneData.scenes.map(async (scene) => {
        try {
          console.log(
            `🎬 Scene ${scene.sceneNumber}: Using ${modelConfig.name}`,
          );
          console.log(`   Prompt: ${scene.visualPrompt.substring(0, 150)}...`);

          const output = await replicate.run(
            modelConfig.id as `${string}/${string}`,
            {
              input: {
                prompt: scene.visualPrompt,
                aspect_ratio: "16:9",
                generation_mode: "quality",
                contrast: "medium",
                num_images: 1,
                prompt_enhance: false,
                style: phoenixStyle,
              },
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

          console.log(`   ✅ Scene ${scene.sceneNumber} image URL:`, imageUrl);

          return {
            sceneNumber: scene.sceneNumber,
            description: scene.description,
            visualPrompt: scene.visualPrompt,
            imageUrl: imageUrl,
            duration: scene.duration,
          };
        } catch (error) {
          console.error(
            `Error generating image for scene ${scene.sceneNumber}:`,
            error,
          );

          return {
            sceneNumber: scene.sceneNumber,
            description: scene.description,
            visualPrompt: scene.visualPrompt,
            imageUrl: undefined,
            duration: scene.duration,
          };
        }
      }),
    );

    return NextResponse.json({
      success: true,
      scenes: scenesWithImages,
      modelInfo: {
        modelKey: "leonardo-phoenix",
        modelName: modelConfig.name,
        style: phoenixStyle,
        estimatedCost: modelConfig.estimatedCost,
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
