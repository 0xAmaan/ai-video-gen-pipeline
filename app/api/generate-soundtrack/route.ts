"use server";

import Replicate from "replicate";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { apiError, apiResponse } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { mockDelay, mockMusicTrack } from "@/lib/demo-mocks/music";
import { getFlowTracker } from "@/lib/flow-tracker";
import { generateMusicPromptFromVisuals } from "@/lib/music-prompt-generator";
import { extractReplicateUrl } from "@/lib/replicate";
import { getConvexClient } from "@/lib/server/convex";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

const MODEL_ID = process.env.REPLICATE_LYRIA2_MODEL ?? "google/lyria-2";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type StoryboardRow = Array<{
  scene: {
    sceneNumber: number;
    title?: string | null;
    description?: string | null;
  };
  shots: Array<{
    shot: {
      description?: string | null;
      mood?: string | null;
      shotNumber?: number | null;
    };
    selectedImage: { iterationPrompt?: string | null } | null;
    selection?: unknown;
  }>;
}>;

const deriveDuration = (output: unknown, fallback: number) => {
  if (Array.isArray(output)) {
    for (const item of output) {
      const duration = deriveDuration(item as unknown, fallback);
      if (duration !== null) return duration;
    }
  }
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const candidates = [
      record.duration,
      record.audio_duration,
      record.seconds,
      record.duration_seconds,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  }
  return fallback || null;
};

const ensureNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  let projectId: Id<"videoProjects"> | undefined;
  let promptOverride: string | undefined;
  let negativePromptOverride: string | undefined;
  let seedOverride: number | undefined;

  try {
    const body = await req.json();
    projectId = body?.projectId as Id<"videoProjects"> | undefined;
    promptOverride = typeof body?.prompt === "string" ? body.prompt : undefined;
    negativePromptOverride =
      typeof body?.negative_prompt === "string"
        ? body.negative_prompt
        : undefined;
    seedOverride = ensureNumber(body?.seed);

    if (!projectId) {
      return apiError("projectId is required", 400);
    }

    const convex = await getConvexClient();
    const [projectData, storyboardRows] = await Promise.all([
      convex.query(api.video.getProjectWithAllData, { projectId }),
      convex.query(api.projectRedesign.getStoryboardRows, { projectId }),
    ]);

    if (!projectData?.project) {
      return apiError("Project not found", 404);
    }

    const clips = projectData.clips ?? [];
    const completedClips = clips.filter((clip) => clip.status === "complete");
    const clipsForTiming =
      completedClips.length > 0 ? completedClips : clips;
    const scenes = projectData.scenes ?? [];
    const storyboard = (storyboardRows as StoryboardRow) ?? [];

    const hasMasterShots = storyboard.some((row) =>
      row.shots.some((shot) => Boolean(shot.selectedImage)),
    );
    if (!hasMasterShots) {
      return apiError(
        "No master shots selected. Finish Storyboard before generating a soundtrack.",
        400,
      );
    }

    const sceneById = new Map(
      scenes.map((scene) => [scene._id as Id<"scenes">, scene]),
    );
    const storyboardBySceneNumber = new Map(
      storyboard.map((row) => [row.scene.sceneNumber, row]),
    );

    const sceneDurations = new Map<
      number,
      { duration: number; sceneId?: Id<"scenes"> }
    >();
    clipsForTiming.forEach((clip) => {
      const duration = ensureNumber(clip.duration);
      if (!duration) return;
      const scene = sceneById.get(clip.sceneId as Id<"scenes">);
      const sceneNumber = scene?.sceneNumber;
      if (typeof sceneNumber !== "number") return;
      const current = sceneDurations.get(sceneNumber) ?? {
        duration: 0,
        sceneId: clip.sceneId as Id<"scenes">,
      };
      sceneDurations.set(sceneNumber, {
        duration: current.duration + duration,
        sceneId: current.sceneId ?? (clip.sceneId as Id<"scenes">),
      });
    });

    const totalDuration = Array.from(sceneDurations.values()).reduce(
      (sum, entry) => sum + entry.duration,
      0,
    );

    if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
      return apiError(
        "Total video duration is unavailable. Generate videos from Storyboard first.",
        400,
      );
    }

    const visualPromptResult = generateMusicPromptFromVisuals({
      durationSeconds: Math.round(totalDuration),
      projectPrompt: projectData.project.prompt,
      scenes: storyboard.map((row) => ({
        title: row.scene.title,
        description: row.scene.description,
        sceneNumber: row.scene.sceneNumber,
        shots: row.shots.map((shot) => ({
          description: shot.shot.description,
          mood: shot.shot.mood,
          shotNumber: shot.shot.shotNumber,
          selectedImagePrompt: shot.selectedImage?.iterationPrompt,
        })),
      })),
    });

    const resolvedPrompt =
      promptOverride?.trim() && promptOverride.trim().length > 0
        ? promptOverride.trim()
        : visualPromptResult.prompt;
    const resolvedNegative =
      negativePromptOverride?.trim() && negativePromptOverride.trim().length > 0
        ? negativePromptOverride.trim()
        : visualPromptResult.negativePrompt;

    const demoMode = getDemoModeFromHeaders(req.headers);
    flowTracker.trackAPICall("POST", "/api/generate-soundtrack", {
      projectId,
      demoMode,
    });

    await convex.mutation(api.video.updateProjectSoundtrack, {
      projectId,
      soundtrackStatus: "generating",
      soundtrackPrompt: resolvedPrompt,
      soundtrackDuration: Math.round(totalDuration),
    });

    const persistSoundtrack = async (
      audioUrl: string,
      durationSeconds: number,
      predictionId: string | null,
    ) => {
      const existingAssets =
        (await convex.query(api.video.getAudioAssets, {
          projectId,
        })) ?? [];

      await Promise.all(
        existingAssets
          .filter(
            (asset) =>
              asset.type === "bgm" &&
              asset.source === "generated" &&
              (asset.provider === "lyria-2" || asset.modelKey === "lyria-2"),
          )
          .map((asset) =>
            convex.mutation(api.video.deleteAudioAsset, {
              assetId: asset._id,
            }),
          ),
      );

      const assetId = await convex.mutation(api.video.createAudioAsset, {
        projectId,
        type: "bgm",
        source: "generated",
        provider: "lyria-2",
        modelKey: "lyria-2",
        url: audioUrl,
        duration: durationSeconds,
        prompt: resolvedPrompt,
        timelineStart: 0,
        metadata: {
          negativePrompt: resolvedNegative,
          seed: seedOverride,
          totalDurationSeconds: totalDuration,
          predictionId,
          provider: MODEL_ID,
        },
      });

      await convex.mutation(api.video.updateProjectSoundtrack, {
        projectId,
        soundtrackUrl: audioUrl,
        soundtrackPrompt: resolvedPrompt,
        soundtrackDuration: durationSeconds,
        soundtrackStatus: "complete",
      });

      return assetId;
    };

    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock soundtrack to avoid API costs",
      );
      await mockDelay(600);
      const mockTrack = mockMusicTrack(resolvedPrompt, Math.round(totalDuration));
      const assetId = await persistSoundtrack(
        mockTrack.audioUrl,
        mockTrack.durationSeconds,
        "mock-lyria-2",
      );
      return apiResponse({
        success: true,
        mode: "mock",
        projectId,
        soundtrackUrl: mockTrack.audioUrl,
        durationSeconds: mockTrack.durationSeconds,
        prompt: resolvedPrompt,
        negativePrompt: resolvedNegative,
        seed: seedOverride ?? null,
        status: "complete",
        assetId,
        totalDuration: totalDuration,
      });
    }

    if (!process.env.REPLICATE_API_KEY) {
      return apiError("Replicate API key is not configured", 500);
    }

    const input: Record<string, unknown> = {
      prompt: resolvedPrompt,
    };
    if (resolvedNegative) {
      input.negative_prompt = resolvedNegative;
    }
    if (typeof seedOverride === "number") {
      input.seed = seedOverride;
    }

    flowTracker.trackModelSelection(
      "Google Lyria 2",
      MODEL_ID,
      undefined,
      "Generating soundtrack with Lyria 2",
    );

    const prediction = await replicate.predictions.create({
      model: MODEL_ID,
      input,
    });

    const maxAttempts = 40;
    let finalPrediction = prediction;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (finalPrediction.status === "succeeded") break;
      if (finalPrediction.status === "failed" ||
        finalPrediction.status === "canceled") {
        throw new Error(
          finalPrediction.error ||
            "Soundtrack generation failed before completion",
        );
      }
      await wait(2500);
      finalPrediction = await replicate.predictions.get(finalPrediction.id);
    }

    if (finalPrediction.status !== "succeeded") {
      throw new Error(
        finalPrediction.error ||
          `Soundtrack generation did not complete (status: ${finalPrediction.status})`,
      );
    }

    const audioUrl = extractReplicateUrl(
      finalPrediction.output,
      "Lyria 2 soundtrack",
    );
    const resolvedDuration = deriveDuration(
      finalPrediction.output,
      Math.round(totalDuration),
    ) ?? Math.round(totalDuration);

    const assetId = await persistSoundtrack(
      audioUrl,
      resolvedDuration,
      finalPrediction.id,
    );

    return apiResponse({
      success: true,
      projectId,
      soundtrackUrl: audioUrl,
      durationSeconds: resolvedDuration,
      prompt: resolvedPrompt,
      negativePrompt: resolvedNegative,
      seed: seedOverride ?? null,
      status: "complete",
      assetId,
      totalDuration: totalDuration,
      sceneBreakdown: Array.from(sceneDurations.entries()).map(
        ([sceneNumber, meta]) => ({
          sceneNumber,
          duration: meta.duration,
          sceneId: meta.sceneId,
          shotCount: storyboardBySceneNumber.get(sceneNumber)?.shots.length ??
            0,
          sceneTitle: storyboardBySceneNumber.get(sceneNumber)?.scene.title,
          sceneDescription:
            storyboardBySceneNumber.get(sceneNumber)?.scene.description,
        }),
      ),
    });
  } catch (error) {
    console.error("generate-soundtrack error:", error);
    try {
      if (projectId) {
        const convex = await getConvexClient();
        await convex.mutation(api.video.updateProjectSoundtrack, {
          projectId,
          soundtrackStatus: "failed",
        });
      }
    } catch (persistError) {
      console.warn("Failed to record soundtrack failure:", persistError);
    }

    return apiError(
      "Failed to generate soundtrack",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
