"use server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { apiError, apiResponse } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (!projectId || typeof projectId !== "string") {
      return apiError("Missing projectId", 400);
    }

    const convex = await getConvexClient();
    const projectIdAsId = projectId as Id<"videoProjects">;

    // Pull storyboard rows (scenes + shots + selected images)
    const storyboard = await convex.query(api.projectRedesign.getStoryboardRows, {
      projectId: projectIdAsId,
    });

    if (!storyboard || storyboard.length === 0) {
      return apiError("No storyboard scenes found for this project", 404);
    }

    // Build legacy scenes payload from selected images
    const scenes = storyboard
      .map((row) => {
        const poster = row.shots.find((shot) => shot.selectedImage)?.selectedImage;
        if (!poster?.imageUrl) return null;
        return {
          sceneNumber: row.scene.sceneNumber,
          description: row.scene.description || row.scene.title || "Untitled scene",
          imageUrl: poster.imageUrl,
          duration: 5, // default to 5s; refined duration can be set later
          replicateImageId: poster.replicateImageId ?? undefined,
        };
      })
      .filter((s): s is NonNullable<typeof s> => !!s)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);

    if (scenes.length === 0) {
      return apiError("No selected images found to generate videos from", 400);
    }

    // Persist into legacy scenes table (video flow expects this)
    const sceneIds = await convex.mutation(api.video.saveScenes, {
      projectId: projectIdAsId,
      scenes,
    });

    return apiResponse({ success: true, sceneIds });
  } catch (error) {
    console.error("promote-storyboard-scenes failed", error);
    return apiError(
      "Failed to promote storyboard scenes",
      500,
      error instanceof Error ? error.message : "unknown error",
    );
  }
}
