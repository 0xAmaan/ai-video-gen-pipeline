import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { STORYBOARD_SYSTEM_PROMPT, buildStoryboardPrompt } from "@/lib/prompts";
import { IMAGE_MODELS } from "@/lib/image-models";
import { extractReplicateUrl } from "@/lib/replicate";
import { synthesizeNarrationAudio } from "@/lib/narration";
import { generateVoiceSelection } from "@/lib/server/voice-selection";
import { getConvexClient } from "@/lib/server/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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
  if (modelConfig.id === "leonardoai/phoenix-1.0" && style) {
    input.generation_mode = "quality";
    input.contrast = "medium";
    input.prompt_enhance = false;
    input.style = style;
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

  const imageUrl = extractReplicateUrl(
    output,
    `scene-${scene.sceneNumber}-image`,
  );

  console.log(`   ✅ Scene ${scene.sceneNumber} image URL:`, imageUrl);
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
  try {
    const { projectId, prompt, responses, imageModel } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 },
      );
    }

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    const projectConvexId = projectId as Id<"videoProjects">;

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
      : openai("gpt-4.1-mini-2025-04-14");

    console.log(
      `🔧 Scene generation model: ${hasGroqKey ? "Groq (gpt-oss-20b) - FAST ⚡" : "OpenAI (gpt-4.1-mini-2025-04-14) - SLOWER 🐌"}`,
    );

    let sceneData: z.infer<typeof sceneSchema>;

    try {
      const result = await generateObject({
        model: modelToUse,
        schema: sceneSchema,
        system: STORYBOARD_SYSTEM_PROMPT,
        prompt: buildStoryboardPrompt(prompt, responses),
        maxRetries: 3,
      });
      sceneData = result.object;
    } catch (error) {
      console.error(
        "❌ Scene generation failed with primary model:",
        error instanceof Error ? error.message : error,
      );

      // If Groq (gpt-oss-20b) is rate limited and OpenAI is available, fall back to gpt-4.1-mini-2025-04-14
      if (hasGroqKey && hasOpenAIKey) {
        console.warn(
          "⚠️ Groq (openai/gpt-oss-20b) failed, falling back to OpenAI (gpt-4.1-mini-2025-04-14) for scene generation",
        );
        const fallbackResult = await generateObject({
          model: openai("gpt-4.1-mini-2025-04-14"),
          schema: sceneSchema,
          system: STORYBOARD_SYSTEM_PROMPT,
          prompt: buildStoryboardPrompt(prompt, responses),
          maxRetries: 3,
        });
        sceneData = fallbackResult.object;
      } else {
        throw error;
      }
    }

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

    // Step 2: Select image generation model
    console.log("\n" + "=".repeat(80));
    console.log("🔍 IMAGE GENERATION MODEL SELECTION");
    console.log("=".repeat(80));

    // Use provided model or default to leonardo-phoenix
    const modelKey = imageModel || "leonardo-phoenix";
    const modelConfig = IMAGE_MODELS[modelKey] || IMAGE_MODELS["leonardo-phoenix"];

    console.log(`   Using model: ${modelConfig.name} (${modelKey})`);

    // Style selection only applies to Leonardo Phoenix
    let phoenixStyle = "cinematic"; // Default style
    const isLeonardoPhoenix = modelKey === "leonardo-phoenix";

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

    console.log(`   Model: ${modelConfig.name}`);
    if (isLeonardoPhoenix) {
      console.log(`   Style: ${phoenixStyle}`);
    }
    console.log(`   Cost: ~$${modelConfig.estimatedCost}/image`);
    console.log("=".repeat(80) + "\n");

    // Step 3 & 4: Generate images and narration in parallel for each scene
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
          narrationText:
            narrationResult?.sanitizedText ?? scene.narrationText,
          narrationUrl: narrationResult?.audioUrl,
          imageUrl,
          duration: scene.duration,
          voiceId: narrationResult?.voiceId ?? voiceSelection.voiceId,
          voiceName: narrationResult?.voiceName ?? voiceSelection.voiceName,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      scenes: scenesWithMedia,
      modelInfo: {
        modelKey: "leonardo-phoenix",
        modelName: modelConfig.name,
        style: phoenixStyle,
        estimatedCost: modelConfig.estimatedCost,
        reason: `Selected ${modelConfig.name} (${phoenixStyle}) based on project preferences.`,
      },
      voiceSelection,
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
