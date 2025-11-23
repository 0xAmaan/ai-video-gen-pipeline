import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new editor asset
 * 
 * @param projectId - The editor project this asset belongs to
 * @param type - Asset type: video, audio, or image
 * @param name - Asset filename
 * @param url - Asset URL (from storage)
 * @param duration - Asset duration in seconds (0 for images)
 * @param metadata - Optional metadata (width, height, fps, etc.)
 * @returns The ID of the created asset
 */
export const createAsset = mutation({
  args: {
    projectId: v.id("editorProjects"),
    type: v.union(v.literal("video"), v.literal("audio"), v.literal("image")),
    name: v.string(),
    url: v.string(),
    duration: v.number(),
    r2Key: v.optional(v.string()),
    proxyUrl: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    thumbnails: v.optional(v.array(v.string())),
    waveform: v.optional(v.any()),
    sampleRate: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const now = Date.now();

    // Verify the project belongs to this user
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.userId !== userId) {
      throw new Error("Not authorized to add assets to this project");
    }

    // Create the asset
    const assetId = await ctx.db.insert("editorAssets", {
      projectId: args.projectId,
      type: args.type,
      name: args.name,
      url: args.url,
      duration: args.duration,
      r2Key: args.r2Key,
      proxyUrl: args.proxyUrl,
      width: args.width,
      height: args.height,
      fps: args.fps,
      thumbnails: args.thumbnails,
      waveform: args.waveform,
      sampleRate: args.sampleRate,
      beatAnalysisStatus: "not_analyzed",
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return assetId;
  },
});

/**
 * Get all assets for a project
 * 
 * @param projectId - The editor project ID
 * @param type - Optional filter by asset type
 * @returns Array of assets
 */
export const getProjectAssets = query({
  args: {
    projectId: v.id("editorProjects"),
    type: v.optional(v.union(v.literal("video"), v.literal("audio"), v.literal("image"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    // Verify the project belongs to this user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    // Query assets
    let query = ctx.db
      .query("editorAssets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    const assets = await query.collect();

    // Filter by type if specified
    if (args.type) {
      return assets.filter((asset) => asset.type === args.type);
    }

    return assets;
  },
});

/**
 * Get a single asset by ID
 * 
 * @param assetId - The asset ID
 * @returns Asset or null
 */
export const getAsset = query({
  args: {
    assetId: v.id("editorAssets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;

    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      return null;
    }

    // Verify the project belongs to this user
    const project = await ctx.db.get(asset.projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    return asset;
  },
});

/**
 * Update asset metadata
 * 
 * @param assetId - The asset ID
 * @param updates - Fields to update
 */
export const updateAsset = mutation({
  args: {
    assetId: v.id("editorAssets"),
    name: v.optional(v.string()),
    thumbnails: v.optional(v.array(v.string())),
    waveform: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const asset = await ctx.db.get(args.assetId);
    
    if (!asset) {
      throw new Error("Asset not found");
    }

    // Verify the project belongs to this user
    const project = await ctx.db.get(asset.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Not authorized to update this asset");
    }

    // Update the asset
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.thumbnails !== undefined) updates.thumbnails = args.thumbnails;
    if (args.waveform !== undefined) updates.waveform = args.waveform;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    await ctx.db.patch(args.assetId, updates);
  },
});

/**
 * Delete an asset
 * 
 * @param assetId - The asset ID to delete
 */
export const deleteAsset = mutation({
  args: {
    assetId: v.id("editorAssets"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const asset = await ctx.db.get(args.assetId);
    
    if (!asset) {
      throw new Error("Asset not found");
    }

    // Verify the project belongs to this user
    const project = await ctx.db.get(asset.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Not authorized to delete this asset");
    }

    // TODO: In future, trigger R2 cleanup if r2Key exists
    // For now, just delete the database record
    await ctx.db.delete(args.assetId);
  },
});

/**
 * Delete all assets for a project
 * Used when deleting a project
 * 
 * @param projectId - The project ID
 */
export const deleteProjectAssets = mutation({
  args: {
    projectId: v.id("editorProjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    // Verify the project belongs to this user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Not authorized to delete assets from this project");
    }

    // Get all assets for this project
    const assets = await ctx.db
      .query("editorAssets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Delete all assets
    for (const asset of assets) {
      await ctx.db.delete(asset._id);
    }

    // TODO: In future, trigger R2 cleanup for all r2Keys
  },
});
