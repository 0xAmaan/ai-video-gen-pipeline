import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save or update editor project
export const saveProject = mutation({
  args: {
    projectId: v.optional(v.string()), // If provided, update existing; otherwise create new
    projectData: v.any(), // Project type from lib/editor/types.ts
    history: v.object({
      past: v.array(v.any()),
      future: v.array(v.any()),
    }),
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
          history: args.history,
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
      history: args.history,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

// Load the most recent editor project for the current user
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
        history: project.history,
      };
    }

    // Otherwise load most recent project
    const projects = await ctx.db
      .query("editorProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    if (projects.length === 0) {
      return null;
    }

    return {
      project: projects[0].projectData,
      history: projects[0].history,
    };
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
