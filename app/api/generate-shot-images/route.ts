"use server";

import Replicate from "replicate";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { apiError, apiResponse } from "@/lib/api-response";
import { mockDelay } from "@/lib/demo-mocks";
import { IMAGE_MODELS } from "@/lib/image-models";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

const MODEL_KEY = "nano-banana";
const MODEL_CONFIG = IMAGE_MODELS[MODEL_KEY];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface GenerateRequestBody {
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotId: Id<"sceneShots">;
  iterationNumber?: number;
  parentImageId?: Id<"shotImages">;
  fixPrompt?: string;
  mode?: "preview" | "iteration";
}

const SYSTEM_PROMPT =
  "Generate a high-quality cinematic image based on the following scene and shot descriptions.";

const normalizeOutput = (output: any): string[] => {
  if (!output) return [];
  if (Array.isArray(output)) {
    return output
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if ("url" in item && typeof item.url === "string") return item.url;
          if ("image" in item && typeof item.image === "string")
            return item.image;
        }
        return null;
      })
      .filter((url): url is string => !!url);
  }

  if (typeof output === "string") {
    return [output];
  }

  if (typeof output === "object") {
    if ("output" in output) {
      return normalizeOutput((output as any).output);
    }
    if ("url" in output && typeof (output as any).url === "string") {
      return [(output as any).url];
    }
  }

  return [];
};

const runPrediction = async (
  prompt: string,
  imageInput?: string,
): Promise<{ predictionId: string; urls: string[] }> => {
  const input: Record<string, any> = {
    prompt,
  };

  if (imageInput) {
    input.image = imageInput;
  }

  const prediction = await replicate.predictions.create({
    version: MODEL_CONFIG.id,
    input,
  });

  let current = prediction;

  while (
    current.status === "starting" ||
    current.status === "processing" ||
    current.status === "queued"
  ) {
    await sleep(1500);
    current = await replicate.predictions.get(current.id);
  }

  if (current.status !== "succeeded") {
    throw new Error(
      `Prediction failed with status ${current.status}: ${current.error || "unknown error"}`,
    );
  }

  return {
    predictionId: current.id,
    urls: normalizeOutput(current.output),
  };
};

const buildIterationPrompt = (
  sceneDescription: string,
  shotPrompt: string,
  fixPrompt?: string,
) => {
  let prompt = `${SYSTEM_PROMPT}
Scene prompt: ${sceneDescription || "N/A"}
Shot prompt: ${shotPrompt || "N/A"}
`;

  if (fixPrompt) {
    prompt += `Additional direction: ${fixPrompt}`;
  }

  return prompt.trim();
};

const createMockImages = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    variantNumber: index,
    imageUrl: `https://picsum.photos/seed/mock-shot-${Date.now()}-${index}/1024/576`,
    status: "complete" as const,
  }));
};

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const startedAt = Date.now();
  let currentShotId: Id<"sceneShots"> | null = null;

  try {
    const body = (await req.json()) as GenerateRequestBody;
    const {
      projectId,
      sceneId,
      shotId,
      iterationNumber: requestedIteration,
      parentImageId,
      fixPrompt,
      mode = "iteration",
    } = body;
    currentShotId = shotId;

    if (!projectId || !sceneId || !shotId) {
      return apiError("Missing required fields", 400);
    }

    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost" || !process.env.REPLICATE_API_KEY;

    flowTracker.trackAPICall("POST", "/api/generate-shot-images", {
      projectId,
      sceneId,
      shotId,
      requestedIteration,
      parentImageId,
    });

    const convex = await getConvexClient({ requireUser: false });
    const shotData = await convex.query(api.projectRedesign.getShotWithScene, {
      shotId,
    });

    if (!shotData) {
      return apiError("Shot not found", 404);
    }

    if (
      shotData.shot.projectId !== projectId ||
      shotData.scene._id !== sceneId
    ) {
      return apiError("Shot does not belong to provided project/scene", 400);
    }

    const hasInitialIteration = shotData.images.some(
      (image) => image.iterationNumber === 0,
    );
    const isInitialRequest = !parentImageId;

    if (isInitialRequest && hasInitialIteration) {
      const existingIteration = shotData.images.filter(
        (image) => image.iterationNumber === 0,
      );
      return apiResponse({
        success: true,
        alreadyGenerated: true,
        iterationNumber: 0,
        images: existingIteration,
      });
    }

    await convex.mutation(api.projectRedesign.updateSceneShot, {
      shotId,
      lastImageGenerationAt: Date.now(),
      lastImageStatus: "processing",
    });

    const latestIteration =
      shotData.images.reduce(
        (max, image) => Math.max(max, image.iterationNumber),
        -1,
      ) + 1;

    const iterationNumber =
      requestedIteration ?? (isInitialRequest ? 0 : latestIteration);

    const parentImage =
      parentImageId &&
      shotData.images.find((image) => image._id === parentImageId);

    if (parentImageId && !parentImage) {
      return apiError("Parent image not found for iteration", 400);
    }

    const fullPromptForGeneration = buildIterationPrompt(
      shotData.scene.description,
      shotData.shot.initialPrompt,
      fixPrompt,
    );

    // Store only the user's refinement command for display in UI
    // For iteration 0, use the shot description
    const iterationPromptForDisplay =
      fixPrompt ||
      (iterationNumber === 0 ? shotData.shot.description : "Refinement");

    const runs = mode === "preview" ? 1 : 3;
    let variantPayloads: Array<{
      variantNumber: number;
      imageUrl: string;
      replicateImageId?: string;
      status: "complete" | "processing" | "failed";
    }> = [];

    if (shouldMock) {
      await mockDelay(150);
      const mockVariants = createMockImages(runs);
      variantPayloads = mockVariants.map((variant, index) => ({
        ...variant,
        variantNumber: index,
        replicateImageId: undefined,
      }));
      flowTracker.trackDecision(
        "Demo mode",
        "mock",
        "Returning mock shot images to avoid API cost",
      );
    } else {
      flowTracker.trackModelSelection(
        MODEL_CONFIG.name,
        MODEL_CONFIG.id,
        MODEL_CONFIG.estimatedCost,
        parentImage ? "Guided refinement" : "Initial exploration",
      );

      const predictionResults: Array<{
        predictionId: string;
        urls: string[];
      }> = [];
      const failedRuns: string[] = [];

      for (let runIndex = 0; runIndex < runs; runIndex++) {
        try {
          const result = await runPrediction(
            fullPromptForGeneration,
            parentImage?.imageUrl,
          );
          predictionResults.push(result);
        } catch (runError) {
          const errorMessage =
            runError instanceof Error
              ? runError.message
              : "Unknown prediction error";
          console.error(
            `Shot iteration prediction ${runIndex + 1}/${runs} failed`,
            runError,
          );
          failedRuns.push(errorMessage);
          flowTracker.trackDecision(
            "Shot iteration run",
            "failed",
            `Run ${runIndex + 1} error: ${errorMessage}`,
          );
        }
      }

      if (predictionResults.length === 0) {
        return apiError(
          "Model returned no images",
          502,
          failedRuns[0] ?? "All prediction runs failed",
        );
      }

      if (failedRuns.length > 0) {
        flowTracker.trackDecision(
          "Shot iteration batch",
          "partial_success",
          `Recovered from ${failedRuns.length} failed run${failedRuns.length === 1 ? "" : "s"}`,
        );
      }

      let variantCounter = 0;
      const allVariants = predictionResults.flatMap((result) =>
        result.urls.map((url) => ({
          variantNumber: variantCounter++,
          imageUrl: url,
          replicateImageId: result.predictionId,
          status: "complete" as const,
        })),
      );

      // Ensure exact number of images (take first N if more, pad with duplicates if less)
      if (allVariants.length >= runs) {
        variantPayloads = allVariants.slice(0, runs).map((v, idx) => ({
          ...v,
          variantNumber: idx,
        }));
      } else {
        variantPayloads = allVariants;
        // If we have fewer than runs, duplicate some to reach runs
        while (variantPayloads.length < runs) {
          const sourceIdx = variantPayloads.length % allVariants.length;
          variantPayloads.push({
            ...allVariants[sourceIdx],
            variantNumber: variantPayloads.length,
          });
        }
      }
    }

    if (variantPayloads.length === 0) {
      return apiError("Model returned no images", 502);
    }

    const insertedIds = await convex.mutation(
      api.projectRedesign.batchCreateShotImages,
      {
        projectId,
        sceneId,
        shotId,
        iterationNumber,
        iterationPrompt: iterationPromptForDisplay,
        parentImageId,
        images: variantPayloads.map((variant) => ({
          variantNumber: variant.variantNumber,
          imageUrl: variant.imageUrl,
          replicateImageId: variant.replicateImageId,
          status: variant.status,
        })),
      },
    );

    const updatedImages = await convex.query(
      api.projectRedesign.getShotImages,
      { shotId },
    );

    const newDocs = updatedImages.filter((image) =>
      insertedIds.some((id) => id === image._id),
    );

    // Auto-select the first image as master shot for preview mode
    const shouldAutoSelect = mode === "preview" && newDocs.length > 0;

    await convex.mutation(api.projectRedesign.updateSceneShot, {
      shotId,
      lastImageGenerationAt: Date.now(),
      lastImageStatus: "complete",
      ...(shouldAutoSelect && { selectedImageId: newDocs[0]._id }),
    });

    flowTracker.trackTiming(
      "Shot iteration generation",
      Date.now() - startedAt,
      startedAt,
    );

    return apiResponse({
      success: true,
      iterationNumber,
      images: newDocs,
    });
  } catch (error) {
    console.error("Error generating shot images:", error);
    if (currentShotId) {
      try {
        const convex = await getConvexClient({ requireUser: false });
        await convex.mutation(api.projectRedesign.updateSceneShot, {
          shotId: currentShotId,
          lastImageGenerationAt: Date.now(),
          lastImageStatus: "failed",
        });
      } catch (statusError) {
        console.error("Failed to mark shot status after error:", statusError);
      }
    }
    return apiError(
      "Failed to generate shot images",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
