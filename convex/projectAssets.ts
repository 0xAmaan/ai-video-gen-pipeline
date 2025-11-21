import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const assetTypeValidator = v.union(
  v.literal("logo"),
  v.literal("product"),
  v.literal("character"),
  v.literal("background"),
  v.literal("prop"),
  v.literal("reference"),
  v.literal("other"),
);

const assetProminenceValidator = v.union(
  v.literal("primary"),
  v.literal("secondary"),
  v.literal("subtle"),
);

export const createProjectAsset = mutation({
  args: {
    projectId: v.id("videoProjects"),
    assetType: assetTypeValidator,
    name: v.string(),
    description: v.optional(v.string()),
    usageNotes: v.optional(v.string()),
    prominence: v.optional(assetProminenceValidator),
    referenceColors: v.optional(v.array(v.string())),
    img2imgStrength: v.optional(v.number()),
    storageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { isActive, ...rest } = args;

    return await ctx.db.insert("projectAssets", {
      ...rest,
      isActive: isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateProjectAsset = mutation({
  args: {
    assetId: v.id("projectAssets"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    usageNotes: v.optional(v.string()),
    prominence: v.optional(assetProminenceValidator),
    referenceColors: v.optional(v.array(v.string())),
    img2imgStrength: v.optional(v.number()),
    storageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    assetType: v.optional(assetTypeValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { assetId, ...updates } = args;

    await ctx.db.patch(assetId, {
      ...updates,
      updatedAt: now,
    });
  },
});

export const toggleAssetActive = mutation({
  args: { assetId: v.id("projectAssets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    await ctx.db.patch(args.assetId, {
      isActive: !asset.isActive,
      updatedAt: Date.now(),
    });
  },
});

export const deleteProjectAsset = mutation({
  args: { assetId: v.id("projectAssets") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.assetId);
  },
});

export const getProjectAssets = query({
  args: {
    projectId: v.id("videoProjects"),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive ?? false;

    let q = ctx.db
      .query("projectAssets")
      .withIndex("by_project", (qb) => qb.eq("projectId", args.projectId));

    if (!includeInactive) {
      q = ctx.db
        .query("projectAssets")
        .withIndex("by_project_active", (qb) =>
          qb.eq("projectId", args.projectId).eq("isActive", true),
        );
    }

    const assets = await q.collect();

    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
        let imageUrl = asset.imageUrl;
        if (asset.storageId && !imageUrl) {
          imageUrl = (await ctx.storage.getUrl(asset.storageId)) ?? undefined;
        }
        return { ...asset, imageUrl };
      })
    );

    return assetsWithUrls.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getAssetsForShot = query({
  args: {
    projectId: v.id("videoProjects"),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive ?? false;
    let q = ctx.db
      .query("projectAssets")
      .withIndex("by_project", (qb) => qb.eq("projectId", args.projectId));

    if (!includeInactive) {
      q = ctx.db
        .query("projectAssets")
        .withIndex("by_project_active", (qb) =>
          qb.eq("projectId", args.projectId).eq("isActive", true),
        );
    }

    const assets = await q.collect();

    return await Promise.all(
      assets.map(async (asset) => {
        let imageUrl = asset.imageUrl;
        if (asset.storageId && !imageUrl) {
          imageUrl = (await ctx.storage.getUrl(asset.storageId)) ?? undefined;
        }
        return { ...asset, imageUrl };
      })
    );
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});
