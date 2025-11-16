import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
// Schema update: Added visualPrompt support for detailed scene descriptions

// Create a new video project
export const createProject = mutation({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const projectId = await ctx.db.insert("videoProjects", {
      userId: identity.subject,
      prompt: args.prompt,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return projectId;
  },
});

// Save generated clarifying questions
export const saveQuestions = mutation({
  args: {
    projectId: v.id("videoProjects"),
    questions: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        options: v.array(
          v.object({
            label: v.string(),
            value: v.string(),
            description: v.string(),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the project belongs to the user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    // Save the questions
    const questionId = await ctx.db.insert("clarifyingQuestions", {
      projectId: args.projectId,
      questions: args.questions,
      generatedAt: Date.now(),
    });

    // Update project status
    await ctx.db.patch(args.projectId, {
      status: "questions_generated",
      updatedAt: Date.now(),
    });

    return questionId;
  },
});

// Save user answers to clarifying questions
export const saveAnswers = mutation({
  args: {
    projectId: v.id("videoProjects"),
    prompt: v.string(),
    responses: v.any(), // Record<string, string>
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the project belongs to the user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    // Find the clarifying questions record
    const questionsRecord = await ctx.db
      .query("clarifyingQuestions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    if (!questionsRecord) {
      throw new Error("Questions not found for this project");
    }

    // Update with answers
    await ctx.db.patch(questionsRecord._id, {
      answers: {
        prompt: args.prompt,
        responses: args.responses,
      },
    });

    // Update project status
    await ctx.db.patch(args.projectId, {
      status: "questions_answered",
      updatedAt: Date.now(),
    });

    return questionsRecord._id;
  },
});

// Get a project by ID
export const getProject = query({
  args: {
    projectId: v.id("videoProjects"),
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

    return project;
  },
});

// Get clarifying questions for a project
export const getQuestions = query({
  args: {
    projectId: v.id("videoProjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const questions = await ctx.db
      .query("clarifyingQuestions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    return questions;
  },
});

// Get all projects for the current user
export const getUserProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const projects = await ctx.db
      .query("videoProjects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return projects;
  },
});

// Save generated scenes for a project
// UPDATED: Added visualPrompt field for detailed video generation prompts
export const saveScenes = mutation({
  args: {
    projectId: v.id("videoProjects"),
    scenes: v.array(
      v.object({
        sceneNumber: v.number(),
        description: v.string(),
        visualPrompt: v.optional(v.string()), // ADDED: Detailed prompt for video generation
        imageStorageId: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        duration: v.number(),
        replicateImageId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the project belongs to the user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const now = Date.now();
    const sceneIds = [];

    // Insert all scenes
    for (const scene of args.scenes) {
      const sceneId = await ctx.db.insert("scenes", {
        projectId: args.projectId,
        sceneNumber: scene.sceneNumber,
        description: scene.description,
        visualPrompt: scene.visualPrompt,
        imageStorageId: scene.imageStorageId,
        imageUrl: scene.imageUrl,
        duration: scene.duration,
        replicateImageId: scene.replicateImageId,
        createdAt: now,
        updatedAt: now,
      });
      sceneIds.push(sceneId);
    }

    // Update project status
    await ctx.db.patch(args.projectId, {
      status: "storyboard_created",
      updatedAt: now,
    });

    return sceneIds;
  },
});

// Get scenes for a project
export const getScenes = query({
  args: {
    projectId: v.id("videoProjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Sort by scene number
    return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  },
});

// Update a specific scene
export const updateScene = mutation({
  args: {
    sceneId: v.id("scenes"),
    description: v.optional(v.string()),
    visualPrompt: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    replicateImageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the scene
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }

    // Verify project ownership
    const project = await ctx.db.get(scene.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    // Update the scene
    const updates: any = { updatedAt: Date.now() };
    if (args.description !== undefined) updates.description = args.description;
    if (args.visualPrompt !== undefined) updates.visualPrompt = args.visualPrompt;
    if (args.imageStorageId !== undefined)
      updates.imageStorageId = args.imageStorageId;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.duration !== undefined) updates.duration = args.duration;
    if (args.replicateImageId !== undefined)
      updates.replicateImageId = args.replicateImageId;

    await ctx.db.patch(args.sceneId, updates);

    return args.sceneId;
  },
});

// Update project status
export const updateProjectStatus = mutation({
  args: {
    projectId: v.id("videoProjects"),
    status: v.union(
      v.literal("draft"),
      v.literal("questions_generated"),
      v.literal("questions_answered"),
      v.literal("generating_storyboard"),
      v.literal("storyboard_created"),
      v.literal("video_generated"),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the project belongs to the user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    await ctx.db.patch(args.projectId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.projectId;
  },
});

// Update multiple scenes at once (for reordering)
export const updateSceneOrder = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneUpdates: v.array(
      v.object({
        sceneId: v.id("scenes"),
        sceneNumber: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const now = Date.now();

    // Update all scenes
    for (const update of args.sceneUpdates) {
      await ctx.db.patch(update.sceneId, {
        sceneNumber: update.sceneNumber,
        updatedAt: now,
      });
    }

    return true;
  },
});

// Delete a scene
export const deleteScene = mutation({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the scene
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }

    // Verify project ownership
    const project = await ctx.db.get(scene.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    await ctx.db.delete(args.sceneId);

    // Renumber remaining scenes to be sequential
    const remainingScenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", scene.projectId))
      .collect();

    const sortedScenes = remainingScenes.sort(
      (a, b) => a.sceneNumber - b.sceneNumber,
    );

    // Update scene numbers to be sequential (1, 2, 3, ...)
    for (let i = 0; i < sortedScenes.length; i++) {
      await ctx.db.patch(sortedScenes[i]._id, {
        sceneNumber: i + 1,
        updatedAt: Date.now(),
      });
    }

    return args.sceneId;
  },
});

// Create video clip record
export const createVideoClip = mutation({
  args: {
    sceneId: v.id("scenes"),
    projectId: v.id("videoProjects"),
    duration: v.number(),
    resolution: v.string(),
    replicateVideoId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const now = Date.now();
    const clipId = await ctx.db.insert("videoClips", {
      sceneId: args.sceneId,
      projectId: args.projectId,
      duration: args.duration,
      resolution: args.resolution,
      replicateVideoId: args.replicateVideoId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return clipId;
  },
});

// Update video clip
export const updateVideoClip = mutation({
  args: {
    clipId: v.id("videoClips"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    videoUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the clip
    const clip = await ctx.db.get(args.clipId);
    if (!clip) {
      throw new Error("Clip not found");
    }

    // Verify project ownership
    const project = await ctx.db.get(clip.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.status !== undefined) updates.status = args.status;
    if (args.videoUrl !== undefined) updates.videoUrl = args.videoUrl;
    if (args.errorMessage !== undefined)
      updates.errorMessage = args.errorMessage;

    await ctx.db.patch(args.clipId, updates);

    return args.clipId;
  },
});

// Get video clips for a project
export const getVideoClips = query({
  args: {
    projectId: v.id("videoProjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const clips = await ctx.db
      .query("videoClips")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return clips;
  },
});

// Create final video record
export const createFinalVideo = mutation({
  args: {
    projectId: v.id("videoProjects"),
    duration: v.number(),
    resolution: v.string(),
    clipCount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const now = Date.now();
    const videoId = await ctx.db.insert("finalVideos", {
      projectId: args.projectId,
      duration: args.duration,
      resolution: args.resolution,
      clipCount: args.clipCount,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return videoId;
  },
});

// Update final video
export const updateFinalVideo = mutation({
  args: {
    videoId: v.id("finalVideos"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    videoUrl: v.optional(v.string()),
    totalCost: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the video
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    // Verify project ownership
    const project = await ctx.db.get(video.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.status !== undefined) updates.status = args.status;
    if (args.videoUrl !== undefined) updates.videoUrl = args.videoUrl;
    if (args.totalCost !== undefined) updates.totalCost = args.totalCost;
    if (args.errorMessage !== undefined)
      updates.errorMessage = args.errorMessage;

    await ctx.db.patch(args.videoId, updates);

    return args.videoId;
  },
});

// Update last active phase
export const updateLastActivePhase = mutation({
  args: {
    projectId: v.id("videoProjects"),
    phase: v.union(
      v.literal("prompt"),
      v.literal("storyboard"),
      v.literal("video"),
      v.literal("editor"),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify the project belongs to the user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    await ctx.db.patch(args.projectId, {
      lastActivePhase: args.phase,
      updatedAt: Date.now(),
    });

    return args.projectId;
  },
});

// Get project with all related data
export const getProjectWithAllData = query({
  args: {
    projectId: v.id("videoProjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      return null;
    }

    // Get clarifying questions
    const questions = await ctx.db
      .query("clarifyingQuestions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    // Get scenes
    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get video clips
    const clips = await ctx.db
      .query("videoClips")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      project,
      questions,
      scenes: scenes.sort((a, b) => a.sceneNumber - b.sceneNumber),
      clips,
    };
  },
});

// Determine current phase based on project status and data
// Determine the furthest unlocked phase for a project
// This is used for fallback redirects when accessing locked phases
export const determineCurrentPhase = query({
  args: {
    projectId: v.id("videoProjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      return null;
    }

    // Check if answers exist
    const questions = await ctx.db
      .query("clarifyingQuestions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    const hasAnswers = questions?.answers !== undefined;

    // Check if scenes exist
    const scenesExist = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    // Check if video clips exist
    const allClips = await ctx.db
      .query("videoClips")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const hasClips = allClips.length > 0;
    const allComplete = allClips.every((clip) => clip.status === "complete");

    // Return furthest unlocked phase
    if (allComplete && hasClips) {
      return "editor";
    }

    if (scenesExist) {
      return "video";
    }

    if (hasAnswers) {
      return "storyboard";
    }

    return "prompt";
  },
});

// Check if video clips are currently generating
export const areClipsGenerating = query({
  args: {
    projectId: v.id("videoProjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      return false;
    }

    const clips = await ctx.db
      .query("videoClips")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Check if any clips are currently processing or pending
    return clips.some(
      (clip) => clip.status === "processing" || clip.status === "pending",
    );
  },
});
