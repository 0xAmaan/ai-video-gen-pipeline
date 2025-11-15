import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
