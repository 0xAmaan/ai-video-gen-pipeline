import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    text: v.string(),
  }),

  videoProjects: defineTable({
    userId: v.string(),
    prompt: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("questions_generated"),
      v.literal("questions_answered"),
      v.literal("storyboard_created"),
      v.literal("video_generated"),
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
});
