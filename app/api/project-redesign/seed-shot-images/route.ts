"use server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { apiResponse, apiError } from "@/lib/api-response";

interface SeedRequestBody {
  projectId?: Id<"videoProjects">;
  concurrency?: number;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SeedRequestBody;
    const projectId = body.projectId;
    if (!projectId) {
      return apiError("projectId is required", 400);
    }

    const convex = await getConvexClient({ requireUser: false });
    const projectData = await convex.query(api.projectRedesign.getCompleteProject, {
      projectId,
    });

    if (!projectData) {
      return apiError("Project not found", 404);
    }

    const tasks: Array<{
      sceneId: Id<"projectScenes">;
      shotId: Id<"sceneShots">;
    }> = [];

    for (const scene of projectData.scenes) {
      for (const shot of scene.shots) {
        const hasInitial = shot.images?.some(
          (image) => image.iterationNumber === 0,
        );
        if (!hasInitial) {
          tasks.push({ sceneId: scene._id, shotId: shot._id });
        }
      }
    }

    if (tasks.length === 0) {
      return apiResponse({
        success: true,
        alreadyComplete: true,
        requested: 0,
        completed: 0,
        failures: [],
      });
    }

    await Promise.all(
      tasks.map((task) =>
        convex.mutation(api.projectRedesign.updateSceneShot, {
          shotId: task.shotId,
          lastImageStatus: "pending",
          lastImageGenerationAt: Date.now(),
        }),
      ),
    );

    const baseUrl = new URL(req.url);
    const targetUrl = new URL(
      "/api/project-redesign/generate-shot-images",
      `${baseUrl.protocol}//${baseUrl.host}`,
    );

    const concurrency = Math.max(1, Math.min(body.concurrency ?? 2, 4));
    const queue = tasks.slice();
    const failures: Array<{ shotId: string; reason: string }> = [];
    let completed = 0;

    const runNext = async (): Promise<void> => {
      const task = queue.shift();
      if (!task) return;
      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-demo-mode": req.headers.get("x-demo-mode") ?? "",
          },
          body: JSON.stringify({
            projectId,
            sceneId: task.sceneId,
            shotId: task.shotId,
          }),
        });
        if (!response.ok) {
          const bodyText = await response.text();
          failures.push({
            shotId: task.shotId,
            reason: bodyText || response.statusText,
          });
        } else {
          completed += 1;
        }
      } catch (error) {
        failures.push({
          shotId: task.shotId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
      await runNext();
    };

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }).map(() =>
      runNext(),
    );
    await Promise.all(workers);

    return apiResponse({
      success: failures.length === 0,
      requested: tasks.length,
      completed,
      failures,
    });
  } catch (error) {
    console.error("seed-shot-images error", error);
    return apiError(
      "Failed to seed shot previews",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
