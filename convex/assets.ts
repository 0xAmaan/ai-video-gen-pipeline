import Replicate from "replicate";
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const ASSET_STATUS = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("complete"),
  v.literal("failed"),
);
type AssetStatus = "pending" | "processing" | "complete" | "failed";

const DEFAULT_REPLICATE_VERSION =
  "66226b38d223f8ac7a81aa33b8519759e300c2f9818a215e32900827ad6d2db5";
const DEFAULT_RESOLUTION = "720p";

const resolveProject = async (
  ctx: any,
  userId: string,
  projectId?: any,
  sceneId?: any,
) => {
  let targetProjectId = projectId;
  if (sceneId) {
    const scene = await ctx.db.get(sceneId);
    if (!scene) throw new Error("Scene not found");
    targetProjectId = targetProjectId ?? scene.projectId;
  }
  if (targetProjectId) {
    const project = await ctx.db.get(targetProjectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found or unauthorized");
    }
  }
  return targetProjectId;
};

const findExistingAsset = async (
  ctx: any,
  args: { predictionId?: string | null; replicateId?: string | null; r2Key?: string | null },
) => {
  if (args.predictionId) {
    const existingByPrediction = await ctx.db
      .query("assets")
      .withIndex("by_prediction", (q: any) => q.eq("predictionId", args.predictionId))
      .first();
    if (existingByPrediction) return existingByPrediction;
  }

  if (args.replicateId) {
    const existingByReplicate = await ctx.db
      .query("assets")
      .withIndex("by_replicate", (q: any) => q.eq("replicateId", args.replicateId))
      .first();
    if (existingByReplicate) return existingByReplicate;
  }

  if (args.r2Key) {
    return await ctx.db
      .query("assets")
      .withIndex("by_key", (q: any) => q.eq("r2Key", args.r2Key))
      .first();
  }

  return null;
};

const mergeMetadata = (incoming?: any, existing?: any) => {
  if (!incoming) return existing;
  if (!existing) return incoming;
  return { ...existing, ...incoming };
};

type SaveAssetArgs = {
  projectId?: any;
  sceneId?: any;
  predictionId?: string | null;
  replicateId?: string | null;
  r2Key?: string | null;
  proxyUrl?: string | null;
  sourceUrl?: string | null;
  kind?: "video" | "audio" | "image";
  status?: AssetStatus;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  sampleRate?: number | null;
  metadata?: any;
  errorMessage?: string | null;
};

const upsertAsset = async (
  ctx: any,
  userId: string,
  args: SaveAssetArgs,
  defaults: Partial<SaveAssetArgs> & { status?: AssetStatus } = {},
) => {
  const existing = await findExistingAsset(ctx, args);
  const projectId = await resolveProject(
    ctx,
    userId,
    args.projectId ?? existing?.projectId,
    args.sceneId ?? existing?.sceneId,
  );

  const now = Date.now();
  const payload = {
    userId,
    projectId,
    sceneId: args.sceneId ?? existing?.sceneId,
    replicateId:
      args.replicateId ??
      args.predictionId ??
      existing?.replicateId ??
      existing?.predictionId,
    predictionId:
      args.predictionId ??
      existing?.predictionId ??
      args.replicateId ??
      existing?.replicateId,
    r2Key: args.r2Key ?? existing?.r2Key,
    proxyUrl: args.proxyUrl ?? existing?.proxyUrl,
    sourceUrl: args.sourceUrl ?? existing?.sourceUrl,
    kind: args.kind ?? existing?.kind ?? "video",
    status: args.status ?? existing?.status ?? defaults.status ?? "pending",
    duration: args.duration ?? existing?.duration ?? undefined,
    width: args.width ?? existing?.width ?? undefined,
    height: args.height ?? existing?.height ?? undefined,
    fps: args.fps ?? existing?.fps ?? undefined,
    sampleRate: args.sampleRate ?? existing?.sampleRate ?? undefined,
    metadata: mergeMetadata(args.metadata, existing?.metadata) ?? undefined,
    errorMessage: args.errorMessage ?? existing?.errorMessage ?? undefined,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }

  return await ctx.db.insert("assets", {
    ...payload,
    createdAt: now,
  });
};

export const saveAsset = mutation({
  args: {
    projectId: v.optional(v.id("videoProjects")),
    sceneId: v.optional(v.id("scenes")),
    predictionId: v.optional(v.string()),
    replicateId: v.optional(v.string()),
    r2Key: v.optional(v.string()),
    proxyUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("video"), v.literal("audio"), v.literal("image"))),
    status: v.optional(ASSET_STATUS),
    duration: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    sampleRate: v.optional(v.number()),
    metadata: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await upsertAsset(ctx, identity.subject, args);
  },
});

export const registerAsset = mutation({
  args: {
    projectId: v.optional(v.id("videoProjects")),
    sceneId: v.optional(v.id("scenes")),
    r2Key: v.string(),
    proxyUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    predictionId: v.optional(v.string()),
    replicateId: v.optional(v.string()),
    kind: v.union(v.literal("video"), v.literal("audio"), v.literal("image")),
    duration: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    sampleRate: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await upsertAsset(ctx, identity.subject, args, { status: "complete" });
  },
});

export const upsertByPrediction = mutation({
  args: {
    projectId: v.optional(v.id("videoProjects")),
    sceneId: v.optional(v.id("scenes")),
    predictionId: v.string(),
    r2Key: v.optional(v.string()),
    proxyUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    kind: v.union(v.literal("video"), v.literal("audio"), v.literal("image")),
    duration: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    sampleRate: v.optional(v.number()),
    metadata: v.optional(v.any()),
    status: v.optional(ASSET_STATUS),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await upsertAsset(ctx, identity.subject, args, {
      status: args.r2Key ? "complete" : "processing",
    });
  },
});

export const listAssets = query({
  args: {
    projectId: v.optional(v.id("videoProjects")),
    status: v.optional(ASSET_STATUS),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (args.projectId) {
      await resolveProject(ctx, identity.subject, args.projectId);
      const assets = await ctx.db
        .query("assets")
        .withIndex("by_project", (q: any) => q.eq("projectId", args.projectId))
        .collect();
      return args.status ? assets.filter((asset: any) => asset.status === args.status) : assets;
    }

    const assets = await ctx.db
      .query("assets")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return args.status ? assets.filter((asset: any) => asset.status === args.status) : assets;
  },
});

export const getAsset = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.userId !== identity.subject) {
      throw new Error("Asset not found or unauthorized");
    }
    if (asset.projectId) {
      await resolveProject(ctx, identity.subject, asset.projectId);
    }
    return asset;
  },
});

export const generateAsset = action({
  args: {
    projectId: v.optional(v.id("videoProjects")),
    sceneId: v.optional(v.id("scenes")),
    prompt: v.string(),
    imageUrl: v.string(),
    duration: v.optional(v.number()),
    resolution: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ predictionId: string; assetId: string; duration: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (!process.env.REPLICATE_API_KEY) {
      throw new Error("Missing REPLICATE_API_KEY for Replicate calls");
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY,
    });

    const targetDuration = args.duration && args.duration > 7.5 ? 10 : 5;
    try {
      const prediction = await replicate.predictions.create({
        version: DEFAULT_REPLICATE_VERSION,
        input: {
          image: args.imageUrl,
          prompt: `${args.prompt}, cinematic, smooth motion, professional`,
          duration: targetDuration,
          resolution: args.resolution ?? DEFAULT_RESOLUTION,
          negative_prompt: "blur, distortion, jitter, artifacts, low quality",
          prompt_expansion: true,
        },
      });

      const assetId = await ctx.runMutation(api.assets.saveAsset, {
        projectId: args.projectId,
        sceneId: args.sceneId,
        predictionId: prediction.id,
        replicateId: prediction.id,
        kind: "video",
        status: "processing",
        metadata: {
          prompt: args.prompt,
          imageUrl: args.imageUrl,
          resolution: args.resolution ?? DEFAULT_RESOLUTION,
          duration: targetDuration,
        },
      });

      return { predictionId: prediction.id, assetId, duration: targetDuration };
    } catch (error) {
      await ctx.runMutation(api.assets.saveAsset, {
        projectId: args.projectId,
        sceneId: args.sceneId,
        status: "failed",
        kind: "video",
        metadata: {
          prompt: args.prompt,
          imageUrl: args.imageUrl,
          resolution: args.resolution ?? DEFAULT_RESOLUTION,
        },
        errorMessage:
          error instanceof Error ? error.message : "Failed to create Replicate prediction",
      });
      throw error;
    }
  },
});
