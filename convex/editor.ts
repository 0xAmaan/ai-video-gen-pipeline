import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

// Save or update editor project (optimized - no history in document)
export const saveProject = mutation({
  args: {
    projectId: v.optional(v.string()), // If provided, update existing; otherwise create new
    projectData: v.any(), // Project type from lib/editor/types.ts
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const now = Date.now();

    // If projectId provided, update existing project
    if (args.projectId) {
      const existing = await ctx.db
        .query("editorProjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("projectData.id"), args.projectId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          projectData: args.projectData,
          updatedAt: now,
        });
        return existing._id;
      }
    }

    // Otherwise create new project
    const id = await ctx.db.insert("editorProjects", {
      userId,
      title: args.projectData.title || "Untitled Project",
      projectData: args.projectData,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

// Save a history snapshot for undo/redo
export const saveHistorySnapshot = mutation({
  args: {
    projectId: v.string(),
    snapshot: v.any(),
    historyType: v.union(v.literal("past"), v.literal("future")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    // Get current history entries of this type
    const existingHistory = await ctx.db
      .query("projectHistory")
      .withIndex("by_project")
      .filter((q) =>
        q.and(
          q.eq(q.field("projectId"), args.projectId),
          q.eq(q.field("historyType"), args.historyType),
          q.eq(q.field("userId"), userId),
        ),
      )
      .collect();

    // Increment sequence numbers for existing entries
    for (const entry of existingHistory) {
      await ctx.db.patch(entry._id, {
        sequenceNumber: entry.sequenceNumber + 1,
      });
    }

    // Insert new snapshot at sequence 0 (most recent)
    await ctx.db.insert("projectHistory", {
      projectId: args.projectId,
      userId,
      snapshot: args.snapshot,
      historyType: args.historyType,
      sequenceNumber: 0,
      createdAt: Date.now(),
    });

    // Prune old history - keep only last 50 entries per type
    const allHistory = await ctx.db
      .query("projectHistory")
      .withIndex("by_project")
      .filter((q) =>
        q.and(
          q.eq(q.field("projectId"), args.projectId),
          q.eq(q.field("historyType"), args.historyType),
          q.eq(q.field("userId"), userId),
        ),
      )
      .collect();

    const sorted = allHistory.sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber,
    );
    if (sorted.length > 50) {
      for (const old of sorted.slice(50)) {
        await ctx.db.delete(old._id);
      }
    }
  },
});

// Clear future history (called when making new change after undo)
export const clearFutureHistory = mutation({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const futureEntries = await ctx.db
      .query("projectHistory")
      .withIndex("by_project")
      .filter((q) =>
        q.and(
          q.eq(q.field("projectId"), args.projectId),
          q.eq(q.field("historyType"), "future"),
          q.eq(q.field("userId"), userId),
        ),
      )
      .collect();

    for (const entry of futureEntries) {
      await ctx.db.delete(entry._id);
    }
  },
});

// Load the most recent editor project for the current user (without history)
export const loadProject = query({
  args: {
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;

    // If specific projectId requested, load that one
    if (args.projectId) {
      const project = await ctx.db
        .query("editorProjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("projectData.id"), args.projectId))
        .first();

      if (!project) {
        return null;
      }

      return {
        project: project.projectData,
      };
    }

    // Otherwise load most recent project
    const projects = await ctx.db
      .query("editorProjects")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    if (projects.length === 0) {
      return null;
    }

    return {
      project: projects[0].projectData,
    };
  },
});

// Load project history separately (paginated)
// Note: This is a mutation (not query) because it needs to be called imperatively
export const loadProjectHistory = mutation({
  args: {
    projectId: v.string(),
    historyType: v.union(v.literal("past"), v.literal("future")),
    limit: v.optional(v.number()), // Default to 10 most recent
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const limit = args.limit ?? 10;

    const history = await ctx.db
      .query("projectHistory")
      .withIndex("by_project")
      .filter((q) =>
        q.and(
          q.eq(q.field("projectId"), args.projectId),
          q.eq(q.field("historyType"), args.historyType),
          q.eq(q.field("userId"), userId),
        ),
      )
      .collect();

    // Sort by sequence number and take the limit
    const sorted = history.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    return sorted.slice(0, limit).map((h) => h.snapshot);
  },
});

// List all editor projects for current user
export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    const projects = await ctx.db
      .query("editorProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return projects.map((p) => ({
      id: p.projectData.id,
      title: p.title,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },
});

// Delete an editor project
export const deleteProject = mutation({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const project = await ctx.db
      .query("editorProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("projectData.id"), args.projectId))
      .first();

    if (!project) {
      throw new Error("Project not found");
    }

    await ctx.db.delete(project._id);
  },
});
