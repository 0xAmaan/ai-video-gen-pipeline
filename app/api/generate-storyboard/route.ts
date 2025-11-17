import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { STORYBOARD_SYSTEM_PROMPT, buildStoryboardPrompt } from "@/lib/prompts";
import { IMAGE_MODELS } from "@/lib/image-models";
import {
  AUDIO_MODELS,
  DEFAULT_VOICE_MODEL,
  type AudioVendor,
} from "@/lib/audio-models";
import { extractReplicateUrl } from "@/lib/replicate";
import { sanitizeNarrationText } from "@/lib/narration";
import { generateVoiceSelection } from "@/lib/server/voice-selection";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";
import { getConvexClient } from "@/lib/server/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

type VoiceVendor = Extract<AudioVendor, "replicate" | "elevenlabs">;

const VOICE_VENDORS: VoiceVendor[] = ["replicate", "elevenlabs"];

const isVoiceVendor = (value: unknown): value is VoiceVendor =>
  typeof value === "string" &&
  (VOICE_VENDORS as string[]).includes(value);

const isAudioModelKey = (
  value: unknown,
): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

const DEFAULT_REPLICATE_VOICE_MODEL =
  "replicate-minimax-tts" as keyof typeof AUDIO_MODELS;

const DEFAULT_ELEVENLABS_VOICE_MODEL = (DEFAULT_VOICE_MODEL ??
  "elevenlabs-multilingual-v2") as keyof typeof AUDIO_MODELS;

async function generateSceneImage(
  scene: GeneratedScene,
  modelConfig: ImageModelConfig,
  style: string,
) {
  console.log(`🎬 Scene ${scene.sceneNumber}: Using ${modelConfig.name}`);
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
        style,
      },
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
    const { projectId, prompt, responses } = await req.json();

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
    const convex = await getConvexClient();

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

    const existingVoiceSettings = await convex
      .query(api.video.getProjectVoiceSettings, {
        projectId: projectConvexId,
      })
      .catch((error) => {
        console.warn("Unable to load project voice settings:", error);
        return null;
      });

    const resolvedProvider: VoiceVendor = existingVoiceSettings &&
      isVoiceVendor(existingVoiceSettings.voiceProvider)
        ? existingVoiceSettings.voiceProvider
        : "replicate";

    const modelKeyHint =
      existingVoiceSettings?.voiceModelKey &&
      isAudioModelKey(existingVoiceSettings.voiceModelKey)
        ? existingVoiceSettings.voiceModelKey
        : resolvedProvider === "elevenlabs"
          ? DEFAULT_ELEVENLABS_VOICE_MODEL
          : DEFAULT_REPLICATE_VOICE_MODEL;

    const voiceAdapter = getVoiceAdapter({
      vendor: resolvedProvider,
      modelKey: modelKeyHint,
    });

    const resolvedVoiceSelection = existingVoiceSettings
      ? {
          voiceId: existingVoiceSettings.selectedVoiceId,
          voiceName: existingVoiceSettings.selectedVoiceName,
          emotion: existingVoiceSettings.emotion ?? "auto",
          speed: existingVoiceSettings.speed ?? 1,
          pitch: existingVoiceSettings.pitch ?? 0,
          reasoning:
            existingVoiceSettings.voiceReasoning ??
            "Voice previously selected for this project.",
          providerVoiceId: existingVoiceSettings.providerVoiceId ?? undefined,
        }
      : {
          ...(await generateVoiceSelection(prompt, responses)),
          providerVoiceId: undefined,
        };

    if (!existingVoiceSettings) {
      try {
        await convex.mutation(api.video.saveProjectVoiceSettings, {
          projectId: projectConvexId,
          selectedVoiceId: resolvedVoiceSelection.voiceId,
          selectedVoiceName: resolvedVoiceSelection.voiceName,
          voiceReasoning: resolvedVoiceSelection.reasoning,
          emotion: resolvedVoiceSelection.emotion,
          speed: resolvedVoiceSelection.speed,
          pitch: resolvedVoiceSelection.pitch,
          voiceProvider: resolvedProvider,
          voiceModelKey: voiceAdapter.providerKey,
        });
      } catch (error) {
        console.warn("Unable to persist voice selection to Convex:", error);
      }
    } else if (
      !existingVoiceSettings.voiceProvider ||
      !existingVoiceSettings.voiceModelKey
    ) {
      try {
        await convex.mutation(api.video.updateProjectVoiceSettings, {
          projectId: projectConvexId,
          selectedVoiceId: resolvedVoiceSelection.voiceId,
          selectedVoiceName: resolvedVoiceSelection.voiceName,
          voiceReasoning: resolvedVoiceSelection.reasoning,
          emotion: resolvedVoiceSelection.emotion,
          speed: resolvedVoiceSelection.speed,
          pitch: resolvedVoiceSelection.pitch,
          voiceProvider: resolvedProvider,
          voiceModelKey: voiceAdapter.providerKey,
          providerVoiceId: existingVoiceSettings.providerVoiceId,
        });
      } catch (error) {
        console.warn("Unable to synchronize voice provider metadata:", error);
      }
    }

    const baseVoiceRequest = {
      voiceId:
        resolvedVoiceSelection.providerVoiceId ??
        resolvedVoiceSelection.voiceId,
      emotion: resolvedVoiceSelection.emotion,
      speed: resolvedVoiceSelection.speed,
      pitch: resolvedVoiceSelection.pitch,
    };

    const responseVoiceSelection = {
      voiceId: resolvedVoiceSelection.voiceId,
      voiceName: resolvedVoiceSelection.voiceName,
      emotion: resolvedVoiceSelection.emotion,
      speed: resolvedVoiceSelection.speed,
      pitch: resolvedVoiceSelection.pitch,
      reasoning: resolvedVoiceSelection.reasoning,
    };

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

    // Step 3 & 4: Generate images and narration in parallel for each scene
    const scenesWithMedia = await Promise.all(
      sceneData.scenes.map(async (scene) => {
        const imagePromise = generateSceneImage(
          scene,
          modelConfig,
          phoenixStyle,
        ).catch((error) => {
          console.error(
            `Error generating image for scene ${scene.sceneNumber}:`,
            error,
          );
          return undefined;
        });

        const sanitizedNarration = sanitizeNarrationText(scene.narrationText);
        const shouldGenerateNarration =
          Boolean(sanitizedNarration.text) && Boolean(baseVoiceRequest.voiceId);

        const narrationPromise = shouldGenerateNarration
          ? voiceAdapter
              .synthesizeVoice({
                text: sanitizedNarration.text,
                voiceId: baseVoiceRequest.voiceId,
                emotion: baseVoiceRequest.emotion,
                speed: baseVoiceRequest.speed,
                pitch: baseVoiceRequest.pitch,
              })
              .catch((error) => {
                console.error(
                  `Error generating narration for scene ${scene.sceneNumber}:`,
                  error,
                );
                return null;
              })
          : Promise.resolve(null);

        const [imageUrl, narrationResult] = await Promise.all([
          imagePromise,
          narrationPromise,
        ]);

        const narrationText =
          sanitizedNarration.text && sanitizedNarration.text.length > 0
            ? sanitizedNarration.text
            : scene.narrationText;

        return {
          sceneNumber: scene.sceneNumber,
          description: scene.description,
          visualPrompt: scene.visualPrompt,
          narrationText,
          narrationUrl: narrationResult?.audioUrl,
          imageUrl,
          duration: scene.duration,
          voiceId:
            narrationResult?.voiceId ?? resolvedVoiceSelection.voiceId,
          voiceName:
            narrationResult?.voiceName ?? resolvedVoiceSelection.voiceName,
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
      voiceSelection: responseVoiceSelection,
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
