import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getConvexClient } from "@/lib/server/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Next.js Route Segment Config
export const maxDuration = 60; // Allow up to 60 seconds for OpenAI + Convex operations
export const dynamic = "force-dynamic"; // Disable caching for API routes

// Zod schema for scene generation output
const shotSchema = z.object({
  shotNumber: z.number().int().positive(),
  description: z
    .string()
    .min(10)
    .describe("Brief description of what happens in this shot"),
  initialPrompt: z
    .string()
    .min(15)
    .describe(
      "Detailed visual prompt optimized for image generation (cinematic, specific, visual details)",
    ),
});

const sceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  title: z.string().min(5).describe("Concise, descriptive scene title"),
  description: z
    .string()
    .min(20)
    .describe("Narrative description of the scene context and purpose"),
  shots: z
    .array(shotSchema)
    .min(2)
    .max(6)
    .describe("Individual shots that make up this scene"),
});

const generateScenesSchema = z.object({
  scenes: z
    .array(sceneSchema)
    .min(2)
    .max(10)
    .describe("Complete scene breakdown for the video project"),
});

type GeneratedShot = z.infer<typeof shotSchema>;
type GeneratedScene = z.infer<typeof sceneSchema>;
type GeneratedScenes = z.infer<typeof generateScenesSchema>;

const SCENE_GENERATION_SYSTEM_PROMPT = `You are an expert video storyboard creator and shot designer. Your role is to transform user concepts into structured, production-ready scene breakdowns.

## Your Expertise:
- Cinematic storytelling and visual narrative structure
- Shot composition and camera angles
- Visual prompt engineering for AI image generation
- Translating abstract ideas into concrete visual scenes

## Guidelines:
1. **Scene Structure**: Create 3-8 scenes that tell a cohesive story
2. **Shot Breakdown**: Each scene should have 2-5 distinct shots with different angles/compositions
3. **Visual Prompts**: Write detailed prompts optimized for image generation models:
   - Include specific visual details (lighting, composition, camera angle)
   - Use cinematic language (e.g., "wide angle shot", "close-up", "golden hour lighting")
   - Be concrete and descriptive, avoiding abstract concepts
   - Consider consistency across shots in the same scene
4. **Adaptability**: Match your output detail level to the input:
   - Vague concept → Create full narrative structure from scratch
   - Scene list → Expand with shots and refined descriptions
   - Detailed breakdown → Structure and enhance what's provided
5. **Quality**: Ensure shots are visually distinct and narratively meaningful

## Output Format:
- Each scene must have a clear title and narrative description
- Each shot must have both a description (what happens) and an initialPrompt (visual details for image generation)
- Maintain logical scene numbering and shot numbering within each scene`;

const buildSceneGenerationPrompt = (
  userInput: string,
  projectTitle?: string,
  projectDescription?: string,
) => {
  let prompt = "";

  if (projectTitle) {
    prompt += `Project Title: "${projectTitle}"\n\n`;
  }

  if (projectDescription) {
    prompt += `Project Context: ${projectDescription}\n\n`;
  }

  prompt += `User Input:\n${userInput}\n\n`;
  prompt += `Based on the above, create a complete scene and shot breakdown for this video project. Each scene should have 2-5 shots with detailed visual prompts suitable for AI image generation.`;

  return prompt;
};

// Demo mode mock data
const generateDemoScenes = (): GeneratedScenes => ({
  scenes: [
    {
      sceneNumber: 1,
      title: "Opening: The Dawn of Innovation",
      description:
        "Establish the setting and introduce the core concept with sweeping visuals",
      shots: [
        {
          shotNumber: 1,
          description:
            "Wide establishing shot of futuristic cityscape at sunrise",
          initialPrompt:
            "Wide angle cinematic shot of modern city skyline at golden hour, glass towers reflecting orange sunrise, soft morning mist, dramatic clouds, 16:9 aspect ratio, photorealistic, high contrast",
        },
        {
          shotNumber: 2,
          description: "Close-up of technology interface coming to life",
          initialPrompt:
            "Close-up shot of holographic interface activating, blue and cyan glowing elements, depth of field, dark background, futuristic UI design, particle effects, cinematic lighting",
        },
      ],
    },
    {
      sceneNumber: 2,
      title: "The Challenge",
      description:
        "Introduce the problem or conflict that drives the narrative forward",
      shots: [
        {
          shotNumber: 1,
          description: "Medium shot showing the core problem visually",
          initialPrompt:
            "Medium shot of person looking at complex data visualization, concerned expression, dramatic side lighting, digital screens in background, shallow depth of field, cinematic composition",
        },
        {
          shotNumber: 2,
          description: "Wide shot emphasizing scale of the challenge",
          initialPrompt:
            "Wide overhead shot of busy workspace with multiple monitors, papers scattered, coffee cups, aerial view, organized chaos, natural window light mixed with screen glow, photorealistic",
        },
      ],
    },
    {
      sceneNumber: 3,
      title: "The Solution",
      description: "Present the resolution and positive outcome",
      shots: [
        {
          shotNumber: 1,
          description: "Dynamic shot of solution being implemented",
          initialPrompt:
            "Dynamic shot of hands interacting with advanced interface, smooth animations, particles of light, bokeh background, professional lighting, modern technology aesthetic, 4k quality",
        },
        {
          shotNumber: 2,
          description: "Triumphant wide shot showing success",
          initialPrompt:
            "Wide cinematic shot of team celebrating success, bright natural lighting, modern office environment, genuine smiles, professional setting, shallow depth of field, warm color grading",
        },
      ],
    },
  ],
});

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  console.log("\n" + "=".repeat(80));
  console.log("🎬 AI SCENE GENERATION REQUEST");
  console.log("=".repeat(80));
  console.time("total-scene-generation");

  try {
    const { projectId, userInput, projectTitle, projectDescription } =
      await req.json();

    flowTracker.trackAPICall("POST", "/api/project-redesign/generate-scenes", {
      projectId,
      demoMode,
      inputLength: userInput?.length ?? 0,
    });

    // Validation
    if (!projectId || typeof projectId !== "string") {
      return apiError("projectId is required", 400);
    }

    if (
      !userInput ||
      typeof userInput !== "string" ||
      userInput.trim().length < 10
    ) {
      return apiError(
        "userInput is required and must be at least 10 characters",
        400,
      );
    }

    const projectConvexId = projectId as Id<"videoProjects">;

    // Demo mode: Return mock data only when explicitly in "no-cost" mode
    if (demoMode === "no-cost") {
      console.log("🎭 Demo mode: Returning mock scene data");
      return apiResponse({
        success: true,
        scenes: generateDemoScenes().scenes,
        message: "Scenes generated successfully (demo mode)",
      });
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY not found in environment");
      return apiError(
        "OpenAI API key not configured",
        500,
        "Please set OPENAI_API_KEY in your .env.local file",
      );
    }

    console.log("🎬 Generating scenes with GPT-4o...");
    console.log(`   Input length: ${userInput.length} characters`);
    if (projectTitle) console.log(`   Project: "${projectTitle}"`);
    console.time("openai-generation");

    // Create timeout promise (50 seconds to leave buffer for DB operations)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Scene generation timeout after 50 seconds")),
        50000,
      ),
    );

    // Generate structured scene output using Vercel AI SDK
    const generationPromise = generateObject({
      model: openai("gpt-4o"),
      schema: generateScenesSchema,
      system: SCENE_GENERATION_SYSTEM_PROMPT,
      prompt: buildSceneGenerationPrompt(
        userInput,
        projectTitle,
        projectDescription,
      ),
      maxRetries: 2, // Reduced from 3 to avoid excessive wait times
      maxTokens: 4000, // Limit response size to prevent runaway generation
      temperature: 0.7, // Balanced creativity/consistency
    });

    // Race between generation and timeout
    const { object: generatedScenes } = await Promise.race([
      generationPromise,
      timeoutPromise,
    ]);

    console.timeEnd("openai-generation");

    console.log(
      `✅ Generated ${generatedScenes.scenes.length} scenes with ${generatedScenes.scenes.reduce((sum, s) => sum + s.shots.length, 0)} total shots`,
    );

    // Persist to Convex (parallelized for performance)
    console.time("convex-persistence");
    const convex = await getConvexClient();

    // Parallelize scene creation
    const sceneCreationPromises = generatedScenes.scenes.map(async (scene) => {
      try {
        // Create scene
        const sceneId = await convex.mutation(
          api.projectRedesign.createProjectScene,
          {
            projectId: projectConvexId,
            sceneNumber: scene.sceneNumber,
            title: scene.title,
            description: scene.description,
          },
        );

        // Parallelize shot creation within this scene
        const shotPromises = scene.shots.map((shot) =>
          convex.mutation(api.projectRedesign.createSceneShot, {
            projectId: projectConvexId,
            sceneId,
            shotNumber: shot.shotNumber,
            description: shot.description,
            initialPrompt: shot.initialPrompt,
          }),
        );

        await Promise.all(shotPromises);

        console.log(
          `   ✅ Scene ${scene.sceneNumber}: "${scene.title}" (${scene.shots.length} shots)`,
        );

        return sceneId;
      } catch (error) {
        console.error(
          `   ❌ Failed to create scene ${scene.sceneNumber}:`,
          error,
        );
        return null; // Return null for failed scenes
      }
    });

    const results = await Promise.all(sceneCreationPromises);
    const createdSceneIds = results.filter(
      (id): id is Id<"projectScenes"> => id !== null,
    );

    console.timeEnd("convex-persistence");
    console.log(
      `📊 Successfully persisted ${createdSceneIds.length}/${generatedScenes.scenes.length} scenes`,
    );

    console.timeEnd("total-scene-generation");
    console.log("=".repeat(80));
    console.log("✅ SCENE GENERATION COMPLETE");
    console.log("=".repeat(80) + "\n");

    // Kick off preview seeding in the background
    try {
      const seedUrl = new URL(
        "/api/project-redesign/seed-shot-images",
        req.url,
      );
      fetch(seedUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-mode": getDemoModeFromHeaders(req.headers) ?? "",
        },
        body: JSON.stringify({
          projectId: projectConvexId,
          concurrency: 2,
        }),
      }).catch((seedError) => {
        console.error("Failed to trigger shot seeding:", seedError);
      });
    } catch (seedBuildError) {
      console.error("Unable to dispatch seed-shot-images request:", seedBuildError);
    }

    return apiResponse({
      success: true,
      scenes: generatedScenes.scenes,
      createdSceneIds,
      message: `Successfully generated and saved ${generatedScenes.scenes.length} scenes`,
    });
  } catch (error) {
    console.timeEnd("total-scene-generation");
    console.error("\n❌ ERROR in scene generation:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    console.log("=".repeat(80) + "\n");

    // Provide helpful error messages
    if (error instanceof Error) {
      // Timeout error
      if (error.message.includes("timeout")) {
        return apiError(
          "Scene generation timed out",
          500,
          "The AI took too long to respond. Try with a shorter or simpler prompt.",
        );
      }

      // API key issues
      if (
        error.message.includes("API key") ||
        error.message.includes("authentication")
      ) {
        return apiError(
          "OpenAI API authentication failed",
          500,
          "Please verify your OPENAI_API_KEY is valid",
        );
      }

      // Rate limit
      if (error.message.includes("rate limit")) {
        return apiError(
          "Rate limit exceeded",
          429,
          "Please wait a moment and try again",
        );
      }

      // Schema validation
      if (
        error.message.includes("schema") ||
        error.message.includes("validation")
      ) {
        return apiError(
          "Invalid AI response format",
          500,
          "The AI generated an invalid response. Please try again.",
        );
      }
    }

    return apiError(
      "Failed to generate scenes",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
