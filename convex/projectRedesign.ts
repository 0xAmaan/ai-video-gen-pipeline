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
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const shotId = await ctx.db.insert("sceneShots", {
      projectId: args.projectId,
      sceneId: args.sceneId,
      shotNumber: args.shotNumber,
      description: args.description,
      initialPrompt: args.initialPrompt,
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
  },
  handler: async (ctx, args) => {
    const updates: any = { updatedAt: Date.now() };

    if (args.description !== undefined) updates.description = args.description;
    if (args.initialPrompt !== undefined)
      updates.initialPrompt = args.initialPrompt;
    if (args.selectedImageId !== undefined)
      updates.selectedImageId = args.selectedImageId;

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
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const updates: any = { updatedAt: Date.now() };

    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.imageStorageId !== undefined)
      updates.imageStorageId = args.imageStorageId;
    if (args.status !== undefined) updates.status = args.status;
    if (args.isFavorite !== undefined) updates.isFavorite = args.isFavorite;
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
