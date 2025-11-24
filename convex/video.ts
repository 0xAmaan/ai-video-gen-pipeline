import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import type { DatabaseReader, DatabaseWriter } from "./_generated/server";

// Create a new video project
export const createProject = mutation({
  args: {
    prompt: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const projectId = await ctx.db.insert("videoProjects", {
      userId: identity.subject,
      name: args.name ?? args.prompt,
      prompt: args.prompt,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return projectId;
  },
});

// ===== Editor persistence (Twick/WebGPU) =====

const ensureOwnedProject = async (
  ctx: { db: DatabaseReader; auth: any },
  projectId: Id<"videoProjects">,
) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== identity.subject) {
    throw new Error("Project not found or unauthorized");
  }
  return { identity, project };
};

export const saveEditorState = mutation({
  args: {
    projectId: v.id("videoProjects"),
    projectData: v.any(),
    sequenceNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { identity } = await ensureOwnedProject(ctx, args.projectId);
    const now = Date.now();

    // Upsert editorProjects row keyed by user + projectData.id (if present)
    const existing = await ctx.db
      .query("editorProjects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    const match = existing.find(
      (row) => row.projectData?.id === args.projectData?.id,
    );

    if (match) {
      await ctx.db.patch(match._id, {
        projectData: args.projectData,
        title: args.projectData?.title,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("editorProjects", {
        userId: identity.subject,
        title: args.projectData?.title,
        projectData: args.projectData,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Cloud history snapshots (bounded)
    const sequenceNumber = args.sequenceNumber ?? now;
    await ctx.db.insert("projectHistory", {
      projectId: args.projectId,
      userId: identity.subject,
      snapshot: args.projectData,
      historyType: "past",
      sequenceNumber,
      createdAt: now,
    });

    // Keep last 20 history entries
    const history = await ctx.db
      .query("projectHistory")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const past = history
      .filter((h) => h.historyType === "past")
      .sort((a, b) => b.sequenceNumber - a.sequenceNumber);
    for (const h of past.slice(20)) {
      await ctx.db.delete(h._id);
    }

    return args.projectId;
  },
});

export const loadEditorState = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const { identity, project } = await ensureOwnedProject(ctx, args.projectId);

    const editor = await ctx.db
      .query("editorProjects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    const history = await ctx.db
      .query("projectHistory")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Pick the row matching current composition id if present, else newest
    const current =
      editor.find(
        (row) => row.projectData?.id === project.compositionState?.id,
      ) ?? editor.sort((a, b) => b.updatedAt - a.updatedAt)[0];

    return {
      projectData: current?.projectData ?? null,
      history: {
        past: history
          .filter((h) => h.historyType === "past")
          .map((h) => h.snapshot),
        future: history
          .filter((h) => h.historyType === "future")
          .map((h) => h.snapshot),
      },
    };
  },
});

export const saveProject = mutation({
  args: {
    projectId: v.id("videoProjects"),
    project: v.any(),
    edl: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(args.projectId);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }

    // Monitor document size before save
    const projectSize = JSON.stringify(args.project).length;
    const edlSize = args.edl ? JSON.stringify(args.edl).length : 0;
    const totalSize = projectSize + edlSize;
    
    // Convex document limit is 1MB (1,048,576 bytes)
    const CONVEX_LIMIT = 1048576;
    const WARNING_THRESHOLD = CONVEX_LIMIT * 0.8; // Warn at 80%
    
    if (totalSize > WARNING_THRESHOLD) {
      console.warn(
        `[saveProject] Large document: ${totalSize} bytes (${Math.round((totalSize / CONVEX_LIMIT) * 100)}% of limit). ` +
        `Project: ${projectSize} bytes, EDL: ${edlSize} bytes`
      );
    }
    
    if (totalSize > CONVEX_LIMIT) {
      throw new Error(
        `Document too large: ${totalSize} bytes exceeds Convex limit of ${CONVEX_LIMIT} bytes. ` +
        `Consider splitting data or removing unnecessary fields.`
      );
    }

    await ctx.db.patch(args.projectId, {
      compositionState: args.project,
      edl: args.edl ?? existing.edl,
      updatedAt: Date.now(),
    });

    return args.projectId;
  },
});

export const loadProjectState = query({
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

    return {
      project: project.compositionState ?? null,
      edl: project.edl ?? null,
      updatedAt: project.updatedAt,
    };
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
export const saveScenes = mutation({
  args: {
    projectId: v.id("videoProjects"),
    scenes: v.array(
      v.object({
        sceneNumber: v.number(),
        description: v.string(),
        imageStorageId: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        duration: v.number(),
        replicateImageId: v.optional(v.string()),
        backgroundMusicUrl: v.optional(v.string()),
        backgroundMusicSource: v.optional(
          v.union(
            v.literal("generated"),
            v.literal("freesound"),
            v.literal("uploaded"),
          ),
        ),
        backgroundMusicPrompt: v.optional(v.string()),
        backgroundMusicMood: v.optional(v.string()),
        redesignShotId: v.optional(v.id("sceneShots")),
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
        imageStorageId: scene.imageStorageId,
        imageUrl: scene.imageUrl,
        duration: scene.duration,
        replicateImageId: scene.replicateImageId,
        backgroundMusicUrl: scene.backgroundMusicUrl,
        backgroundMusicSource: scene.backgroundMusicSource,
        backgroundMusicPrompt: scene.backgroundMusicPrompt,
        backgroundMusicMood: scene.backgroundMusicMood,
        redesignShotId: scene.redesignShotId,
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

    // Get permanent storage URLs for scenes with imageStorageId
    const scenesWithUrls = await Promise.all(
      scenes.map(async (scene) => {
        let imageUrl = scene.imageUrl;
        // If we have a storage ID, get the permanent URL
        if (scene.imageStorageId) {
          const storageUrl = await ctx.storage.getUrl(scene.imageStorageId);
          if (storageUrl) {
            imageUrl = storageUrl;
          }
        }
        return { ...scene, imageUrl };
      }),
    );

    // Sort by scene number
    return scenesWithUrls.sort((a, b) => a.sceneNumber - b.sceneNumber);
  },
});

// Update a specific scene
export const updateScene = mutation({
  args: {
    sceneId: v.id("scenes"),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    replicateImageId: v.optional(v.string()),
    backgroundMusicUrl: v.optional(v.string()),
    backgroundMusicSource: v.optional(
      v.union(
        v.literal("generated"),
        v.literal("freesound"),
        v.literal("uploaded"),
      ),
    ),
    backgroundMusicPrompt: v.optional(v.string()),
    backgroundMusicMood: v.optional(v.string()),
    redesignShotId: v.optional(v.id("sceneShots")),
    visualPrompt: v.optional(v.string()),
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
    if (args.imageStorageId !== undefined)
      updates.imageStorageId = args.imageStorageId;
    if (args.imageUrl !== undefined) updates.imageUrl = args.imageUrl;
    if (args.duration !== undefined) updates.duration = args.duration;
    if (args.replicateImageId !== undefined)
      updates.replicateImageId = args.replicateImageId;
    if (args.backgroundMusicUrl !== undefined)
      updates.backgroundMusicUrl = args.backgroundMusicUrl;
    if (args.backgroundMusicSource !== undefined)
      updates.backgroundMusicSource = args.backgroundMusicSource;
    if (args.backgroundMusicPrompt !== undefined)
      updates.backgroundMusicPrompt = args.backgroundMusicPrompt;
    if (args.backgroundMusicMood !== undefined)
      updates.backgroundMusicMood = args.backgroundMusicMood;
    if (args.redesignShotId !== undefined)
      updates.redesignShotId = args.redesignShotId;
    if (args.visualPrompt !== undefined)
      updates.visualPrompt = args.visualPrompt;

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

export const updateProjectTitle = mutation({
  args: { projectId: v.id("videoProjects"), title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    await ctx.db.patch(args.projectId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return args.projectId;
  },
});

export const deleteProject = mutation({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    // Best-effort cleanup of related records
    const collections = [
      "clarifyingQuestions",
      "scenes",
      "videoClips",
      "audioAssets",
      "projectScenes",
      "sceneShots",
      "shotImages",
      "storyboardSelections",
      "projectAssets",
      "projectScenesAssets",
      "editorProjects",
      "projectHistory",
      "finalVideos",
      "assets",
    ] as const;
    for (const table of collections) {
      const query = ctx.db.query(table as any);
      // Many tables share projectId field; fall back to index where available
      let records: any[] = [];
      try {
        records = await query
          .withIndex("by_project", (q: any) =>
            q.eq("projectId", args.projectId),
          )
          .collect();
      } catch {
        records = await query.collect();
      }
      for (const record of records) {
        if (record.projectId === args.projectId) {
          await ctx.db.delete(record._id);
        }
      }
    }
    await ctx.db.delete(args.projectId);
    return args.projectId;
  },
});

export const saveCompositionState = mutation({
  args: {
    projectId: v.id("videoProjects"),
    compositionState: v.optional(v.any()),
    edl: v.optional(v.any()),
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

    await ctx.db.patch(args.projectId, {
      compositionState: args.compositionState ?? project.compositionState,
      edl: args.edl ?? project.edl,
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
    proxyUrl: v.optional(v.string()),
    r2Key: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    replicateVideoId: v.optional(v.string()),
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
    if (args.proxyUrl !== undefined) updates.proxyUrl = args.proxyUrl;
    if (args.r2Key !== undefined) updates.r2Key = args.r2Key;
    if (args.sourceUrl !== undefined) updates.sourceUrl = args.sourceUrl;
    if (args.errorMessage !== undefined)
      updates.errorMessage = args.errorMessage;
    if (args.replicateVideoId !== undefined)
      updates.replicateVideoId = args.replicateVideoId;

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

export const clearVideoClips = mutation({
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

    // Delete all video clips for this project
    const clips = await ctx.db
      .query("videoClips")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const clip of clips) {
      await ctx.db.delete(clip._id);
    }

    return clips.length;
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

// Get the most recent final video for a project
export const getFinalVideo = query({
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

    return await ctx.db
      .query("finalVideos")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .first();
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

export const getProjectVoiceSettings = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      return null;
    }
    return await ctx.db
      .query("projectVoiceSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();
  },
});

const upsertProjectVoiceSettings = async (
  ctx: any,
  projectId: Id<"videoProjects">,
  payload: {
    selectedVoiceId: string;
    selectedVoiceName: string;
    voiceReasoning?: string;
    emotion?: string;
    speed?: number;
    pitch?: number;
    voiceProvider?: string;
    voiceModelKey?: string;
    providerVoiceId?: string;
  },
) => {
  const existing = await ctx.db
    .query("projectVoiceSettings")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .first();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...payload,
      updatedAt: now,
    });
    return existing._id;
  }
  return ctx.db.insert("projectVoiceSettings", {
    projectId,
    ...payload,
    createdAt: now,
    updatedAt: now,
  });
};

export const saveProjectVoiceSettings = mutation({
  args: {
    projectId: v.id("videoProjects"),
    selectedVoiceId: v.string(),
    selectedVoiceName: v.string(),
    voiceReasoning: v.optional(v.string()),
    emotion: v.optional(v.string()),
    speed: v.optional(v.number()),
    pitch: v.optional(v.number()),
    voiceProvider: v.optional(v.string()),
    voiceModelKey: v.optional(v.string()),
    providerVoiceId: v.optional(v.string()),
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
    return upsertProjectVoiceSettings(ctx, args.projectId, {
      selectedVoiceId: args.selectedVoiceId,
      selectedVoiceName: args.selectedVoiceName,
      voiceReasoning: args.voiceReasoning,
      emotion: args.emotion,
      speed: args.speed,
      pitch: args.pitch,
      voiceProvider: args.voiceProvider,
      voiceModelKey: args.voiceModelKey,
      providerVoiceId: args.providerVoiceId,
    });
  },
});

export const updateProjectVoiceSettings = mutation({
  args: {
    projectId: v.id("videoProjects"),
    selectedVoiceId: v.string(),
    selectedVoiceName: v.string(),
    voiceReasoning: v.optional(v.string()),
    emotion: v.optional(v.string()),
    speed: v.optional(v.number()),
    pitch: v.optional(v.number()),
    voiceProvider: v.optional(v.string()),
    voiceModelKey: v.optional(v.string()),
    providerVoiceId: v.optional(v.string()),
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
    return upsertProjectVoiceSettings(ctx, args.projectId, {
      selectedVoiceId: args.selectedVoiceId,
      selectedVoiceName: args.selectedVoiceName,
      voiceReasoning: args.voiceReasoning,
      emotion: args.emotion,
      speed: args.speed,
      pitch: args.pitch,
      voiceProvider: args.voiceProvider,
      voiceModelKey: args.voiceModelKey,
      providerVoiceId: args.providerVoiceId,
    });
  },
});

export const updateProjectBackgroundMusic = mutation({
  args: {
    projectId: v.id("videoProjects"),
    backgroundMusicUrl: v.optional(v.string()),
    backgroundMusicSource: v.optional(
      v.union(
        v.literal("generated"),
        v.literal("freesound"),
        v.literal("uploaded"),
      ),
    ),
    backgroundMusicPrompt: v.optional(v.string()),
    backgroundMusicMood: v.optional(v.string()),
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
    await ctx.db.patch(args.projectId, {
      backgroundMusicUrl: args.backgroundMusicUrl,
      backgroundMusicSource: args.backgroundMusicSource,
      backgroundMusicPrompt: args.backgroundMusicPrompt,
      backgroundMusicMood: args.backgroundMusicMood,
      updatedAt: Date.now(),
    });
    return args.projectId;
  },
});

export const updateProjectSoundtrack = mutation({
  args: {
    projectId: v.id("videoProjects"),
    soundtrackUrl: v.optional(v.string()),
    soundtrackPrompt: v.optional(v.string()),
    soundtrackDuration: v.optional(v.number()),
    soundtrackStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
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

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.soundtrackUrl !== undefined) {
      updates.soundtrackUrl = args.soundtrackUrl;
    }
    if (args.soundtrackPrompt !== undefined) {
      updates.soundtrackPrompt = args.soundtrackPrompt;
    }
    if (args.soundtrackDuration !== undefined) {
      updates.soundtrackDuration = args.soundtrackDuration;
    }
    if (args.soundtrackStatus !== undefined) {
      updates.soundtrackStatus = args.soundtrackStatus;
    }

    await ctx.db.patch(args.projectId, updates);
    return args.projectId;
  },
});

export const updateProjectAudioTrackSettings = mutation({
  args: {
    projectId: v.id("videoProjects"),
    audioNarration: v.optional(
      v.object({
        volume: v.optional(v.number()),
        muted: v.optional(v.boolean()),
      }),
    ),
    audioBgm: v.optional(
      v.object({
        volume: v.optional(v.number()),
        muted: v.optional(v.boolean()),
      }),
    ),
    audioSfx: v.optional(
      v.object({
        volume: v.optional(v.number()),
        muted: v.optional(v.boolean()),
      }),
    ),
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
    await ctx.db.patch(args.projectId, {
      audioTrackSettings: {
        audioNarration: args.audioNarration,
        audioBgm: args.audioBgm,
        audioSfx: args.audioSfx,
      },
      updatedAt: Date.now(),
    });
    return args.projectId;
  },
});

export const updateProjectModelSelection = mutation({
  args: {
    projectId: v.id("videoProjects"),
    stage: v.union(v.literal("text"), v.literal("image"), v.literal("video")),
    modelId: v.string(),
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
    const updates: any = { updatedAt: Date.now() };
    if (args.stage === "text") updates.textModelId = args.modelId;
    if (args.stage === "image") updates.imageModelId = args.modelId;
    if (args.stage === "video") updates.videoModelId = args.modelId;
    await ctx.db.patch(args.projectId, updates);
    return args.projectId;
  },
});

export const resetProjectPhase = mutation({
  args: {
    projectId: v.id("videoProjects"),
    stage: v.union(v.literal("text"), v.literal("video")),
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
    if (args.stage === "text") {
      const questions = await ctx.db
        .query("clarifyingQuestions")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
      for (const qRecord of questions) {
        await ctx.db.delete(qRecord._id);
      }
      await ctx.db.patch(args.projectId, {
        status: "draft",
        textModelId: undefined,
        updatedAt: Date.now(),
      });
      return args.projectId;
    }
    // video stage: clear clips and related status
    const clips = await ctx.db
      .query("videoClips")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const clip of clips) {
      await ctx.db.delete(clip._id);
    }
    await ctx.db.patch(args.projectId, {
      videoModelId: undefined,
      lastActivePhase: "storyboard",
      updatedAt: Date.now(),
    });
    return args.projectId;
  },
});

export const updateSceneNarration = mutation({
  args: {
    sceneId: v.id("scenes"),
    narrationUrl: v.optional(v.string()),
    narrationText: v.optional(v.string()),
    voiceId: v.optional(v.string()),
    voiceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }
    const project = await ctx.db.get(scene.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    await ctx.db.patch(args.sceneId, {
      narrationUrl: args.narrationUrl,
      narrationText: args.narrationText,
      voiceId: args.voiceId,
      voiceName: args.voiceName,
      updatedAt: Date.now(),
    });
    return args.sceneId;
  },
});

export const updateSceneLipsync = mutation({
  args: {
    sceneId: v.id("scenes"),
    lipsyncStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    lipsyncVideoUrl: v.optional(v.string()),
    lipsyncPredictionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }
    const project = await ctx.db.get(scene.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    await ctx.db.patch(args.sceneId, {
      lipsyncStatus: args.lipsyncStatus,
      lipsyncVideoUrl: args.lipsyncVideoUrl,
      lipsyncPredictionId: args.lipsyncPredictionId,
      updatedAt: Date.now(),
    });
    return args.sceneId;
  },
});

export const updateVideoClipLipsync = mutation({
  args: {
    clipId: v.id("videoClips"),
    lipsyncVideoUrl: v.optional(v.string()),
    hasLipsync: v.optional(v.boolean()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
        v.literal("cancelled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clip = await ctx.db.get(args.clipId);
    if (!clip) {
      throw new Error("Clip not found");
    }
    const project = await ctx.db.get(clip.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    const updates: any = { updatedAt: Date.now() };
    if (args.lipsyncVideoUrl !== undefined)
      updates.lipsyncVideoUrl = args.lipsyncVideoUrl;
    if (args.hasLipsync !== undefined) updates.hasLipsync = args.hasLipsync;
    if (args.status !== undefined) updates.status = args.status;
    await ctx.db.patch(args.clipId, updates);
    return args.clipId;
  },
});

export const saveLipsyncPrediction = mutation({
  args: { sceneId: v.id("scenes"), predictionId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }
    const project = await ctx.db.get(scene.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    await ctx.db.patch(args.sceneId, {
      lipsyncPredictionId: args.predictionId,
      lipsyncStatus: "processing",
      updatedAt: Date.now(),
    });
    return args.sceneId;
  },
});

export const getSceneById = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const scene = await ctx.db.get(args.sceneId);
    if (!scene) return null;
    const project = await ctx.db.get(scene.projectId);
    if (!project || project.userId !== identity.subject) {
      return null;
    }
    return scene;
  },
});

export const cancelVideoClip = mutation({
  args: { clipId: v.id("videoClips") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const clip = await ctx.db.get(args.clipId);
    if (!clip) {
      throw new Error("Clip not found");
    }
    const project = await ctx.db.get(clip.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    await ctx.db.patch(args.clipId, {
      status: "cancelled",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
    });
    return args.clipId;
  },
});

export const createAudioAsset = mutation({
  args: {
    projectId: v.id("videoProjects"),
    sceneId: v.optional(v.id("scenes")),
    type: v.union(
      v.literal("bgm"),
      v.literal("sfx"),
      v.literal("narration"),
      v.literal("voiceover"),
    ),
    source: v.union(
      v.literal("generated"),
      v.literal("freesound"),
      v.literal("uploaded"),
      v.literal("external"),
    ),
    url: v.string(),
    duration: v.optional(v.number()),
    prompt: v.optional(v.string()),
    mood: v.optional(v.string()),
    provider: v.optional(v.string()),
    modelKey: v.optional(v.string()),
    timelineStart: v.optional(v.number()),
    timelineEnd: v.optional(v.number()),
    beatMarkers: v.optional(
      v.array(
        v.object({
          time: v.number(),
          strength: v.optional(v.number()),
          isDownbeat: v.optional(v.boolean()),
        }),
      ),
    ),
    bpm: v.optional(v.number()),
    beatAnalysisStatus: v.optional(
      v.union(
        v.literal("not_analyzed"),
        v.literal("analyzing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("rate_limited"),
      ),
    ),
    analysisError: v.optional(v.string()),
    analysisMethod: v.optional(
      v.union(
        v.literal("replicate"),
        v.literal("client"),
        v.literal("manual"),
      ),
    ),
    metadata: v.optional(v.any()),
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
    const now = Date.now();
    return ctx.db.insert("audioAssets", {
      projectId: args.projectId,
      sceneId: args.sceneId,
      type: args.type,
      source: args.source,
      provider: args.provider,
      modelKey: args.modelKey,
      url: args.url,
      duration: args.duration,
      prompt: args.prompt,
      mood: args.mood,
      timelineStart: args.timelineStart,
      timelineEnd: args.timelineEnd,
      beatMarkers: args.beatMarkers,
      bpm: args.bpm,
      beatAnalysisStatus: args.beatAnalysisStatus ?? "not_analyzed",
      analysisError: args.analysisError,
      analysisMethod: args.analysisMethod,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAudioAsset = mutation({
  args: {
    assetId: v.id("audioAssets"),
    type: v.optional(
      v.union(
        v.literal("bgm"),
        v.literal("sfx"),
        v.literal("narration"),
        v.literal("voiceover"),
      ),
    ),
    source: v.optional(
      v.union(
        v.literal("generated"),
        v.literal("freesound"),
        v.literal("uploaded"),
        v.literal("external"),
      ),
    ),
    provider: v.optional(v.string()),
    modelKey: v.optional(v.string()),
    sceneId: v.optional(v.id("scenes")),
    url: v.optional(v.string()),
    duration: v.optional(v.number()),
    prompt: v.optional(v.string()),
    mood: v.optional(v.string()),
    timelineStart: v.optional(v.number()),
    timelineEnd: v.optional(v.number()),
    metadata: v.optional(v.any()),
    beatMarkers: v.optional(
      v.array(
        v.object({
          time: v.number(),
          strength: v.optional(v.number()),
          isDownbeat: v.optional(v.boolean()),
        }),
      ),
    ),
    bpm: v.optional(v.number()),
    beatAnalysisStatus: v.optional(
      v.union(
        v.literal("not_analyzed"),
        v.literal("analyzing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("rate_limited"),
      ),
    ),
    analysisError: v.optional(v.string()),
    analysisMethod: v.optional(
      v.union(
        v.literal("replicate"),
        v.literal("client"),
        v.literal("manual"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }
    const project = await ctx.db.get(asset.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    await ctx.db.patch(args.assetId, {
      type: args.type ?? asset.type,
      source: args.source ?? asset.source,
      provider: args.provider ?? asset.provider,
      modelKey: args.modelKey ?? asset.modelKey,
      sceneId: args.sceneId ?? asset.sceneId,
      url: args.url ?? asset.url,
      duration: args.duration ?? asset.duration,
      prompt: args.prompt ?? asset.prompt,
      mood: args.mood ?? asset.mood,
      timelineStart: args.timelineStart ?? asset.timelineStart,
      timelineEnd: args.timelineEnd ?? asset.timelineEnd,
      beatMarkers: args.beatMarkers ?? asset.beatMarkers,
      bpm: args.bpm ?? asset.bpm,
      beatAnalysisStatus: args.beatAnalysisStatus ?? asset.beatAnalysisStatus,
      analysisError: args.analysisError ?? asset.analysisError,
      analysisMethod: args.analysisMethod ?? asset.analysisMethod,
      metadata: args.metadata ?? asset.metadata,
      updatedAt: Date.now(),
    });
    return args.assetId;
  },
});

export const deleteAudioAsset = mutation({
  args: { assetId: v.id("audioAssets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }
    const project = await ctx.db.get(asset.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or unauthorized");
    }
    await ctx.db.delete(args.assetId);
    return args.assetId;
  },
});

export const getAudioAssets = query({
  args: { projectId: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      return [];
    }
    return ctx.db
      .query("audioAssets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
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

    const audioAssets = await ctx.db
      .query("audioAssets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      project,
      questions,
      scenes: scenes.sort((a, b) => a.sceneNumber - b.sceneNumber),
      clips,
      audioAssets,
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
