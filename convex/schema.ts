import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  videoProjects: defineTable({
    userId: v.string(),
    prompt: v.string(),
    title: v.optional(v.string()), // Custom project title (defaults to prompt if not set)
    status: v.union(
      v.literal("draft"),
      v.literal("questions_generated"),
      v.literal("questions_answered"),
      v.literal("character_selected"),
      v.literal("generating_storyboard"),
      v.literal("storyboard_created"),
      v.literal("video_generated"),
    ),
    lastActivePhase: v.optional(
      v.union(
        v.literal("prompt"),
        v.literal("character-select"),
        v.literal("storyboard"),
        v.literal("video"),
        v.literal("editor"),
      ),
    ),
    referenceImageUrl: v.optional(v.string()),
    selectedModel: v.optional(v.string()),
    textModelId: v.optional(v.string()),
    imageModelId: v.optional(v.string()),
    videoModelId: v.optional(v.string()),
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
    description: v.string(), // Short narrative description for UI display
    visualPrompt: v.optional(v.string()), // Detailed 150-250 word prompt for video generation
    imageStorageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()), // Convex storage URL
    narrationUrl: v.optional(v.string()), // Generated narration audio URL
    narrationText: v.optional(v.string()), // Narration script used for audio
    voiceId: v.optional(v.string()), // MiniMax voice identifier
    voiceName: v.optional(v.string()), // Human-readable voice label
    duration: v.number(), // Duration in seconds
    lipsyncVideoUrl: v.optional(v.string()), // Final lip-synced video
    lipsyncStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ), // Tracks lip sync processing state
    lipsyncPredictionId: v.optional(v.string()), // Replicate prediction ID
    replicateImageId: v.optional(v.string()), // For tracking Replicate prediction
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  projectVoiceSettings: defineTable({
    projectId: v.id("videoProjects"),
    selectedVoiceId: v.string(),
    selectedVoiceName: v.string(),
    voiceReasoning: v.optional(v.string()),
    emotion: v.optional(v.string()),
    speed: v.optional(v.number()),
    pitch: v.optional(v.number()),
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
      v.literal("cancelled"),
    ),
    duration: v.number(),
    resolution: v.string(),
    lipsyncVideoUrl: v.optional(v.string()), // Processed lip synced clip
    originalVideoUrl: v.optional(v.string()), // Original non-lipsynced clip
    hasLipsync: v.optional(v.boolean()), // Flag to indicate clip has lipsync applied
    cancelledAt: v.optional(v.number()), // Timestamp when cancelled
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_project", ["projectId"]),

  // Editor projects (Konva timeline editor)
  editorProjects: defineTable({
    userId: v.string(),
    title: v.string(),
    // Store the entire project state as JSON
    projectData: v.any(), // Project type from lib/editor/types.ts
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  // Separate table for undo/redo history to avoid document size limits
  projectHistory: defineTable({
    projectId: v.string(), // References editorProjects.projectData.id
    userId: v.string(), // For access control
    snapshot: v.any(), // Project snapshot for undo/redo
    historyType: v.union(v.literal("past"), v.literal("future")), // Track undo vs redo
    sequenceNumber: v.number(), // Order in history (0 = most recent past, 1 = older, etc)
    createdAt: v.number(),
  })
    .index("by_project", ["projectId", "historyType", "sequenceNumber"])
    .index("by_user", ["userId", "createdAt"]),
});
