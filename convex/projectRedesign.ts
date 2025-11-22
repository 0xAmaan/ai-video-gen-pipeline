import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ========================================
// PROJECT MUTATIONS
// ========================================

export const createRedesignProject = mutation({
  args: {
    userId: v.string(),
    prompt: v.string(),
    title: v.optional(v.string()),
    promptPlannerData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const projectId = await ctx.db.insert("videoProjects", {
      userId: args.userId,
      prompt: args.prompt,
      title: args.title || args.prompt,
      workflowVersion: "v2_redesign",
      redesignStatus: "prompt_planning",
      status: "draft", // Keep legacy status for compatibility
      promptPlannerData: args.promptPlannerData,
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

export const updatePromptPlanner = mutation({
  args: {
    projectId: v.id("videoProjects"),
    promptPlannerData: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      promptPlannerData: args.promptPlannerData,
      updatedAt: Date.now(),
    });
  },
});

export const updateRedesignStatus = mutation({
  args: {
    projectId: v.id("videoProjects"),
    status: v.union(
      v.literal("prompt_planning"),
      v.literal("asset_upload"),
      v.literal("scenes_generating"),
      v.literal("scenes_setup"),
      v.literal("shot_iteration"),
      v.literal("storyboard_final"),
      v.literal("animation_complete"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      redesignStatus: args.status,
      updatedAt: Date.now(),
    });
  },
});

// ========================================
// SCENE MUTATIONS
// ========================================

export const createProjectScene = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneNumber: v.number(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const sceneId = await ctx.db.insert("projectScenes", {
      projectId: args.projectId,
      sceneNumber: args.sceneNumber,
      title: args.title,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });

    return sceneId;
  },
});

export const updateProjectScene = mutation({
  args: {
    sceneId: v.id("projectScenes"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { updatedAt: Date.now() };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.sceneId, updates);
  },
});

export const deleteProjectScene = mutation({
  args: {
    sceneId: v.id("projectScenes"),
  },
  handler: async (ctx, args) => {
    // Delete all shots in this scene
    const shots = await ctx.db
      .query("sceneShots")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();

    for (const shot of shots) {
      // Delete all images for this shot
      const images = await ctx.db
        .query("shotImages")
        .withIndex("by_shot", (q) => q.eq("shotId", shot._id))
        .collect();

      for (const image of images) {
        await ctx.db.delete(image._id);
      }

      // Delete storyboard selections
      const selections = await ctx.db
        .query("storyboardSelections")
        .withIndex("by_shot", (q) => q.eq("shotId", shot._id))
        .collect();

      for (const selection of selections) {
        await ctx.db.delete(selection._id);
      }

      await ctx.db.delete(shot._id);
    }

    await ctx.db.delete(args.sceneId);
  },
});

export const reorderScenes = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneOrders: v.array(
      v.object({
        sceneId: v.id("projectScenes"),
        sceneNumber: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const { sceneId, sceneNumber } of args.sceneOrders) {
      await ctx.db.patch(sceneId, {
        sceneNumber,
        updatedAt: now,
      });
    }
  },
});

// ========================================
// SHOT MUTATIONS
// ========================================

export const createSceneShot = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotNumber: v.number(),
    description: v.string(),
    initialPrompt: v.string(),
    referencedAssets: v.optional(v.array(v.id("projectAssets"))),
    lastImageGenerationAt: v.optional(v.number()),
    lastImageStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const shotId = await ctx.db.insert("sceneShots", {
      projectId: args.projectId,
      sceneId: args.sceneId,
      shotNumber: args.shotNumber,
      description: args.description,
      initialPrompt: args.initialPrompt,
      referencedAssets: args.referencedAssets,
      lastImageGenerationAt: args.lastImageGenerationAt,
      lastImageStatus: args.lastImageStatus,
      createdAt: now,
      updatedAt: now,
    });

    return shotId;
  },
});

export const updateSceneShot = mutation({
  args: {
    shotId: v.id("sceneShots"),
    description: v.optional(v.string()),
    initialPrompt: v.optional(v.string()),
    selectedImageId: v.optional(v.id("shotImages")),
    referencedAssets: v.optional(v.array(v.id("projectAssets"))),
    lastImageGenerationAt: v.optional(v.number()),
    lastImageStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const updates: any = { updatedAt: Date.now() };

    if (args.description !== undefined) updates.description = args.description;
    if (args.initialPrompt !== undefined)
      updates.initialPrompt = args.initialPrompt;
    if (args.selectedImageId !== undefined)
      updates.selectedImageId = args.selectedImageId;
    if (args.referencedAssets !== undefined)
      updates.referencedAssets = args.referencedAssets;
    if (args.lastImageGenerationAt !== undefined)
      updates.lastImageGenerationAt = args.lastImageGenerationAt;
    if (args.lastImageStatus !== undefined)
      updates.lastImageStatus = args.lastImageStatus;

    await ctx.db.patch(args.shotId, updates);
  },
});

export const deleteSceneShot = mutation({
  args: {
    shotId: v.id("sceneShots"),
  },
  handler: async (ctx, args) => {
    // Delete all images for this shot
    const images = await ctx.db
      .query("shotImages")
      .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
      .collect();

    for (const image of images) {
      await ctx.db.delete(image._id);
    }

    // Delete storyboard selections
    const selections = await ctx.db
      .query("storyboardSelections")
      .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
      .collect();

    for (const selection of selections) {
      await ctx.db.delete(selection._id);
    }

    await ctx.db.delete(args.shotId);
  },
});

export const reorderSceneShots = mutation({
  args: {
    sceneId: v.id("projectScenes"),
    shotOrders: v.array(
      v.object({
        shotId: v.id("sceneShots"),
        shotNumber: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const { shotId, shotNumber } of args.shotOrders) {
      const shot = await ctx.db.get(shotId);
      if (!shot || shot.sceneId !== args.sceneId) continue;

      await ctx.db.patch(shotId, {
        shotNumber,
        updatedAt: now,
      });
    }
  },
});

export const moveShotToScene = mutation({
  args: {
    shotId: v.id("sceneShots"),
    newSceneId: v.id("projectScenes"),
  },
  handler: async (ctx, args) => {
    const shot = await ctx.db.get(args.shotId);
    if (!shot) throw new Error("Shot not found");

    await ctx.db.patch(args.shotId, {
      sceneId: args.newSceneId,
      updatedAt: Date.now(),
    });
  },
});

export const clearShotImage = mutation({
  args: {
    shotId: v.id("sceneShots"),
  },
  handler: async (ctx, args) => {
    const shot = await ctx.db.get(args.shotId);
    if (!shot) throw new Error("Shot not found");

    const [images, selections, legacyScenes] = await Promise.all([
      ctx.db
        .query("shotImages")
        .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
        .collect(),
      ctx.db
        .query("storyboardSelections")
        .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
        .collect(),
      ctx.db
        .query("scenes")
        .withIndex("by_redesignShot", (q) => q.eq("redesignShotId", args.shotId))
        .collect(),
    ]);

    for (const image of images) {
      await ctx.db.delete(image._id);
    }

    for (const selection of selections) {
      await ctx.db.delete(selection._id);
    }

    for (const legacyScene of legacyScenes) {
      await ctx.db.delete(legacyScene._id);
    }

    await ctx.db.patch(args.shotId, {
      description: "",
      initialPrompt: "",
      selectedImageId: undefined,
      lastImageGenerationAt: undefined,
      lastImageStatus: undefined,
      updatedAt: Date.now(),
    });
  },
});

// ========================================
// SHOT IMAGE MUTATIONS
// ========================================

export const createShotImage = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotId: v.id("sceneShots"),
    iterationNumber: v.number(),
    variantNumber: v.number(),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.string()),
    iterationPrompt: v.string(),
    parentImageId: v.optional(v.id("shotImages")),
    replicateImageId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    isFavorite: v.optional(v.boolean()),
    usedAssets: v.optional(v.array(v.id("projectAssets"))),
    sourcePromptVersion: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const imageId = await ctx.db.insert("shotImages", {
      projectId: args.projectId,
      sceneId: args.sceneId,
      shotId: args.shotId,
      iterationNumber: args.iterationNumber,
      variantNumber: args.variantNumber,
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      iterationPrompt: args.iterationPrompt,
      parentImageId: args.parentImageId,
      replicateImageId: args.replicateImageId,
      status: args.status || "complete",
      isFavorite: args.isFavorite || false,
      usedAssets: args.usedAssets,
      sourcePromptVersion: args.sourcePromptVersion,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return imageId;
  },
});

export const updateShotImage = mutation({
  args: {
    imageId: v.id("shotImages"),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    isFavorite: v.optional(v.boolean()),
    usedAssets: v.optional(v.array(v.id("projectAssets"))),
    sourcePromptVersion: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const updates: any = { updatedAt: Date.now() };

    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.imageStorageId !== undefined)
      updates.imageStorageId = args.imageStorageId;
    if (args.status !== undefined) updates.status = args.status;
    if (args.isFavorite !== undefined) updates.isFavorite = args.isFavorite;
    if (args.usedAssets !== undefined) updates.usedAssets = args.usedAssets;
    if (args.sourcePromptVersion !== undefined)
      updates.sourcePromptVersion = args.sourcePromptVersion;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    await ctx.db.patch(args.imageId, updates);
  },
});

export const toggleShotImageFavorite = mutation({
  args: {
    imageId: v.id("shotImages"),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");

    await ctx.db.patch(args.imageId, {
      isFavorite: !image.isFavorite,
      updatedAt: Date.now(),
    });

    return !image.isFavorite;
  },
});

export const deleteShotImage = mutation({
  args: {
    imageId: v.id("shotImages"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.imageId);
  },
});

// Batch create images for initial generation
export const batchCreateShotImages = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotId: v.id("sceneShots"),
    iterationNumber: v.number(),
    iterationPrompt: v.string(),
    parentImageId: v.optional(v.id("shotImages")),
    images: v.array(
      v.object({
        variantNumber: v.number(),
        imageUrl: v.string(),
        imageStorageId: v.optional(v.string()),
        replicateImageId: v.optional(v.string()),
        status: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("complete"),
            v.literal("failed"),
          ),
        ),
        usedAssets: v.optional(v.array(v.id("projectAssets"))),
        sourcePromptVersion: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const imageIds: Id<"shotImages">[] = [];
    const now = Date.now();

    for (const img of args.images) {
      const imageId = await ctx.db.insert("shotImages", {
        projectId: args.projectId,
        sceneId: args.sceneId,
        shotId: args.shotId,
        iterationNumber: args.iterationNumber,
        variantNumber: img.variantNumber,
        imageUrl: img.imageUrl,
        imageStorageId: img.imageStorageId,
        iterationPrompt: args.iterationPrompt,
        parentImageId: args.parentImageId,
        replicateImageId: img.replicateImageId,
        status: img.status || "complete",
        isFavorite: false,
        usedAssets: img.usedAssets,
        sourcePromptVersion: img.sourcePromptVersion,
        createdAt: now,
        updatedAt: now,
      });

      imageIds.push(imageId);
    }

    return imageIds;
  },
});

// ========================================
// STORYBOARD MUTATIONS
// ========================================

export const createStoryboardSelection = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotId: v.id("sceneShots"),
    selectedImageId: v.id("shotImages"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if selection already exists for this shot
    const existing = await ctx.db
      .query("storyboardSelections")
      .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
      .first();

    if (existing) {
      // Update existing selection
      await ctx.db.patch(existing._id, {
        selectedImageId: args.selectedImageId,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new selection
    const selectionId = await ctx.db.insert("storyboardSelections", {
      projectId: args.projectId,
      sceneId: args.sceneId,
      shotId: args.shotId,
      selectedImageId: args.selectedImageId,
      createdAt: now,
      updatedAt: now,
    });

    // Update the shot's selectedImageId
    await ctx.db.patch(args.shotId, {
      selectedImageId: args.selectedImageId,
      updatedAt: now,
    });

    return selectionId;
  },
});

export const updateStoryboardAnimation = mutation({
  args: {
    selectionId: v.id("storyboardSelections"),
    animationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    animatedVideoUrl: v.optional(v.string()),
    replicateVideoId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { updatedAt: Date.now() };

    if (args.animationStatus !== undefined)
      updates.animationStatus = args.animationStatus;
    if (args.animatedVideoUrl !== undefined)
      updates.animatedVideoUrl = args.animatedVideoUrl;
    if (args.replicateVideoId !== undefined)
      updates.replicateVideoId = args.replicateVideoId;

    await ctx.db.patch(args.selectionId, updates);
  },
});

export const syncShotToLegacyScene = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotId: v.id("sceneShots"),
    selectedImageId: v.id("shotImages"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const plannerScene = await ctx.db.get(args.sceneId);
    if (!plannerScene || plannerScene.projectId !== args.projectId) {
      throw new Error("Scene not found or unauthorized");
    }

    const shot = await ctx.db.get(args.shotId);
    if (!shot || shot.projectId !== args.projectId) {
      throw new Error("Shot not found or unauthorized");
    }

    if (shot.sceneId !== args.sceneId) {
      throw new Error("Shot does not belong to provided scene");
    }

    const selectedImage = await ctx.db.get(args.selectedImageId);
    if (!selectedImage || selectedImage.projectId !== args.projectId) {
      throw new Error("Selected image not found or unauthorized");
    }

    console.log("[syncShotToLegacyScene] SELECTED IMAGE DATA:", {
      selectedImageId: args.selectedImageId,
      imageUrl: selectedImage.imageUrl,
      storageId: selectedImage.storageId,
      replicateImageId: selectedImage.replicateImageId,
    });

    const now = Date.now();

    const projectScenes = await ctx.db
      .query("projectScenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const sceneOrderMap = new Map(
      projectScenes.map((scene) => [scene._id, scene.sceneNumber]),
    );

    const allShots = await ctx.db
      .query("sceneShots")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const sortedShots = allShots.sort((a, b) => {
      const sceneNumberA =
        sceneOrderMap.get(a.sceneId) ?? Number.MAX_SAFE_INTEGER;
      const sceneNumberB =
        sceneOrderMap.get(b.sceneId) ?? Number.MAX_SAFE_INTEGER;
      if (sceneNumberA !== sceneNumberB) {
        return sceneNumberA - sceneNumberB;
      }
      return a.shotNumber - b.shotNumber;
    });

    const desiredSceneNumbers = new Map<Id<"sceneShots">, number>();
    sortedShots.forEach((shotDoc, index) => {
      desiredSceneNumbers.set(shotDoc._id, index + 1);
    });

    const legacyScenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const redesignScenes = legacyScenes.filter(
      (scene) => scene.redesignShotId !== undefined,
    );
    const scenesByShotId = new Map(
      redesignScenes.map((scene) => [
        scene.redesignShotId as Id<"sceneShots">,
        scene,
      ]),
    );

    const targetSceneNumber =
      desiredSceneNumbers.get(args.shotId) ?? redesignScenes.length + 1;
    const description =
      shot.description ||
      (plannerScene.title
        ? `${plannerScene.title} — Shot ${shot.shotNumber}`
        : `Shot ${shot.shotNumber}`);
    const visualPrompt = shot.initialPrompt || description;
    const narrationText = shot.description || plannerScene.description;
    const duration = 5;

    const existingScene = scenesByShotId.get(args.shotId);
    let syncedSceneId: Id<"scenes">;

    console.log("[syncShotToLegacyScene] SAVING TO LEGACY SCENE:", {
      shotId: args.shotId,
      targetSceneNumber,
      imageUrl: selectedImage.imageUrl,
      willUpdate: !!existingScene,
      existingSceneId: existingScene?._id,
    });

    if (existingScene) {
      await ctx.db.patch(existingScene._id, {
        sceneNumber: targetSceneNumber,
        description,
        visualPrompt,
        imageUrl: selectedImage.imageUrl,
        duration,
        narrationText,
        replicateImageId: selectedImage.replicateImageId,
        redesignShotId: args.shotId,
        updatedAt: now,
      });
      syncedSceneId = existingScene._id;
    } else {
      syncedSceneId = await ctx.db.insert("scenes", {
        projectId: args.projectId,
        sceneNumber: targetSceneNumber,
        description,
        visualPrompt,
        imageUrl: selectedImage.imageUrl,
        duration,
        narrationText,
        replicateImageId: selectedImage.replicateImageId,
        redesignShotId: args.shotId,
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log("[syncShotToLegacyScene] SYNCED SCENE ID:", syncedSceneId);

    const latestLegacyScenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const latestRedesignScenes = latestLegacyScenes.filter(
      (scene) => scene.redesignShotId !== undefined,
    );
    for (const legacyScene of latestRedesignScenes) {
      const shotId = legacyScene.redesignShotId as Id<"sceneShots">;
      const desiredNumber = desiredSceneNumbers.get(shotId);
      if (
        desiredNumber !== undefined &&
        legacyScene.sceneNumber !== desiredNumber
      ) {
        await ctx.db.patch(legacyScene._id, {
          sceneNumber: desiredNumber,
          updatedAt: Date.now(),
        });
      }
    }

    if (
      project.status !== "storyboard_created" &&
      project.status !== "video_generated"
    ) {
      await ctx.db.patch(args.projectId, {
        status: "storyboard_created",
        updatedAt: Date.now(),
      });
    }

    return syncedSceneId;
  },
});

// ========================================
// QUERIES
// ========================================

export const getRedesignProject = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const getProjectScenes = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projectScenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const getSceneShots = query({
  args: { sceneId: v.id("projectScenes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sceneShots")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .order("asc")
      .collect();
  },
});

export const getShotWithScene = query({
  args: { shotId: v.id("sceneShots") },
  handler: async (ctx, args) => {
    const shot = await ctx.db.get(args.shotId);
    if (!shot) return null;

    const scene = await ctx.db.get(shot.sceneId);
    if (!scene) return null;

    const images = await ctx.db
      .query("shotImages")
      .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
      .order("asc")
      .collect();

    const storyboardSelection = await ctx.db
      .query("storyboardSelections")
      .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
      .first();

    return {
      shot,
      scene,
      images,
      storyboardSelection,
    };
  },
});

export const getShotImages = query({
  args: {
    shotId: v.id("sceneShots"),
    iterationNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("shotImages")
      .withIndex("by_shot", (q) => q.eq("shotId", args.shotId));

    const images = await query.collect();

    // Filter by iteration if specified
    if (args.iterationNumber !== undefined) {
      return images.filter(
        (img) => img.iterationNumber === args.iterationNumber,
      );
    }

    return images;
  },
});

export const getShotImagesByScene = query({
  args: { sceneId: v.id("projectScenes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shotImages")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
  },
});

export const getStoryboardSelections = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storyboardSelections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getStoryboardByScene = query({
  args: { sceneId: v.id("projectScenes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("storyboardSelections")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
  },
});

export const getProjectShotSelections = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const selections = await ctx.db
      .query("storyboardSelections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const enriched = await Promise.all(
      selections.map(async (selection) => {
        const shot = await ctx.db.get(selection.shotId);
        if (!shot) return null;

        const scene = await ctx.db.get(shot.sceneId);
        if (!scene) return null;

        const image = await ctx.db.get(selection.selectedImageId);
        if (!image) return null;

        return {
          selection,
          shot,
          scene,
          image,
        };
      }),
    );

    return enriched
      .filter((item): item is NonNullable<typeof item> => !!item)
      .sort((a, b) => b.selection.updatedAt - a.selection.updatedAt);
  },
});

export const getShotPreviewImages = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    // Get all shots to check which have selected images
    const shots = await ctx.db
      .query("sceneShots")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const images = await ctx.db
      .query("shotImages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const previews = new Map<Id<"sceneShots">, any[]>();

    // First pass: add selected master shots (from any iteration)
    for (const shot of shots) {
      if (!shot.selectedImageId) continue;

      const selectedImage = images.find(
        (img) => img._id === shot.selectedImageId,
      );
      if (!selectedImage) continue;

      previews.set(shot._id, [
        {
          _id: selectedImage._id,
          shotId: selectedImage.shotId,
          imageUrl: selectedImage.imageUrl,
          status: selectedImage.status,
          variantNumber: selectedImage.variantNumber,
        },
      ]);
    }

    // Second pass: for shots without selected master, show latest iteration's first image
    // Group images by shotId to find latest iteration
    const shotIterations = new Map<Id<"sceneShots">, number>();
    for (const image of images) {
      const currentMax = shotIterations.get(image.shotId) ?? -1;
      if (image.iterationNumber > currentMax) {
        shotIterations.set(image.shotId, image.iterationNumber);
      }
    }

    for (const image of images) {
      if (previews.has(image.shotId)) continue; // Already has selected master

      const latestIteration = shotIterations.get(image.shotId) ?? 0;
      if (image.iterationNumber !== latestIteration) continue; // Only latest iteration for fallback

      const list = previews.get(image.shotId) ?? [];
      if (list.length >= 1) continue; // Only one preview per shot

      list.push({
        _id: image._id,
        shotId: image.shotId,
        imageUrl: image.imageUrl,
        status: image.status,
        variantNumber: image.variantNumber,
      });
      previews.set(image.shotId, list);
    }

    return Array.from(previews.entries()).map(([shotId, imgs]) => ({
      shotId,
      images: imgs.sort((a, b) => a.variantNumber - b.variantNumber),
    }));
  },
});

// Get complete project data with all nested entities
export const getCompleteProject = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const scenes = await ctx.db
      .query("projectScenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();

    const scenesWithData = await Promise.all(
      scenes.map(async (scene) => {
        const shots = await ctx.db
          .query("sceneShots")
          .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
          .order("asc")
          .collect();

        const shotsWithImages = await Promise.all(
          shots.map(async (shot) => {
            const images = await ctx.db
              .query("shotImages")
              .withIndex("by_shot", (q) => q.eq("shotId", shot._id))
              .collect();

            const storyboardSelection = await ctx.db
              .query("storyboardSelections")
              .withIndex("by_shot", (q) => q.eq("shotId", shot._id))
              .first();

            return {
              ...shot,
              images,
              storyboardSelection,
            };
          }),
        );

        return {
          ...scene,
          shots: shotsWithImages,
        };
      }),
    );

    return {
      project,
      scenes: scenesWithData,
    };
  },
});

export const getStoryboardRows = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const scenes = await ctx.db
      .query("projectScenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();

    return await Promise.all(
      scenes.map(async (scene) => {
        const shots = await ctx.db
          .query("sceneShots")
          .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
          .order("asc")
          .collect();

        const shotsWithSelections = await Promise.all(
          shots.map(async (shot) => {
            const selectedImage = shot.selectedImageId
              ? await ctx.db.get(shot.selectedImageId)
              : null;

            const selection = await ctx.db
              .query("storyboardSelections")
              .withIndex("by_shot", (q) => q.eq("shotId", shot._id))
              .first();

            return {
              shot,
              selectedImage,
              selection,
            };
          }),
        );

        return {
          scene,
          shots: shotsWithSelections,
        };
      }),
    );
  },
});

// Get the latest iteration number for a shot
export const getLatestIterationNumber = query({
  args: { shotId: v.id("sceneShots") },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("shotImages")
      .withIndex("by_shot", (q) => q.eq("shotId", args.shotId))
      .collect();

    if (images.length === 0) return -1;

    return Math.max(...images.map((img) => img.iterationNumber));
  },
});
