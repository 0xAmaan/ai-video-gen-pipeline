import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  videoProjects: defineTable({
    userId: v.string(),
    prompt: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("questions_generated"),
      v.literal("questions_answered"),
      v.literal("generating_storyboard"),
      v.literal("storyboard_created"),
      v.literal("video_generated"),
    ),
    lastActivePhase: v.optional(
      v.union(
        v.literal("prompt"),
        v.literal("storyboard"),
        v.literal("video"),
        v.literal("editor"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  clarifyingQuestions: defineTable({
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
    answers: v.optional(
      v.object({
        prompt: v.string(),
        // Dynamic answers stored as key-value pairs (questionId: answer)
        responses: v.any(), // Will store Record<string, string>
      }),
    ),
    generatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  scenes: defineTable({
    projectId: v.id("videoProjects"),
    sceneNumber: v.number(),
    description: v.string(),
    imageStorageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()), // Convex storage URL
    duration: v.number(), // Duration in seconds
    replicateImageId: v.optional(v.string()), // For tracking Replicate prediction
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  videoClips: defineTable({
    sceneId: v.id("scenes"),
    projectId: v.id("videoProjects"),
    videoUrl: v.optional(v.string()),
    replicateVideoId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    duration: v.number(),
    resolution: v.string(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_project", ["projectId"]),

  finalVideos: defineTable({
    projectId: v.id("videoProjects"),
    videoUrl: v.optional(v.string()),
    duration: v.number(),
    resolution: v.string(),
    clipCount: v.number(),
    totalCost: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),
});
