import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

export const createBrandAsset = mutation({
  args: {
    name: v.string(),
    folder: v.optional(v.string()),
    assetType: assetTypeValidator,
    description: v.optional(v.string()),
    usageNotes: v.optional(v.string()),
    prominence: v.optional(assetProminenceValidator),
    referenceColors: v.optional(v.array(v.string())),
    img2imgStrength: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();

    return await ctx.db.insert("brandAssets", {
      userId: identity.subject,
      name: args.name,
      folder: args.folder?.trim() || undefined,
      assetType: args.assetType,
      description: args.description,
      usageNotes: args.usageNotes,
      prominence: args.prominence,
      referenceColors: args.referenceColors,
      img2imgStrength: args.img2imgStrength,
      tags: args.tags,
      imageUrl: args.imageUrl,
      storageId: args.storageId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBrandAsset = mutation({
  args: {
    assetId: v.id("brandAssets"),
    name: v.optional(v.string()),
    folder: v.optional(v.string()),
    description: v.optional(v.string()),
    usageNotes: v.optional(v.string()),
    prominence: v.optional(assetProminenceValidator),
    referenceColors: v.optional(v.array(v.string())),
    img2imgStrength: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    assetType: v.optional(assetTypeValidator),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(args.assetId);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Asset not found or unauthorized");
    }

    const updates = { ...args } as Record<string, unknown>;
    delete updates.assetId;

    await ctx.db.patch(args.assetId, {
      ...updates,
      folder: args.folder?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const deleteBrandAsset = mutation({
  args: { assetId: v.id("brandAssets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(args.assetId);
    if (!existing || existing.userId !== identity.subject) {
      throw new Error("Asset not found or unauthorized");
    }

    await ctx.db.delete(args.assetId);
  },
});

export const getBrandAssets = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const assets = await ctx.db
      .query("brandAssets")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return await Promise.all(
      assets.map(async (asset) => {
        let imageUrl = asset.imageUrl;
        if (asset.storageId && !imageUrl) {
          imageUrl = (await ctx.storage.getUrl(asset.storageId)) ?? undefined;
        }
        return { ...asset, imageUrl };
      }),
    );
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  return await ctx.storage.generateUploadUrl();
});
