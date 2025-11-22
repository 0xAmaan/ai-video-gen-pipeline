import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const beatMarkerValidator = v.object({
  time: v.number(),
  strength: v.optional(v.number()),
  isDownbeat: v.optional(v.boolean()),
});

export default defineSchema({
  videoProjects: defineTable({
    userId: v.string(),
    prompt: v.string(),
    title: v.optional(v.string()),
    name: v.optional(v.string()), // legacy field
    status: v.union(
      v.literal("draft"),
      v.literal("questions_generated"),
      v.literal("questions_answered"),
      v.literal("character_selected"),
      v.literal("generating_storyboard"),
      v.literal("storyboard_created"),
      v.literal("video_generated"),
    ),
    workflowVersion: v.optional(
      v.union(v.literal("v1_legacy"), v.literal("v2_redesign")),
    ),
    promptPlannerData: v.optional(v.string()),
    redesignStatus: v.optional(
      v.union(
        v.literal("prompt_planning"),
        v.literal("asset_upload"),
        v.literal("scenes_generating"),
        v.literal("scenes_setup"),
        v.literal("shot_iteration"),
        v.literal("storyboard_final"),
        v.literal("animation_complete"),
      ),
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
    backgroundMusicUrl: v.optional(v.string()),
    backgroundMusicSource: v.optional(
      v.union(
        v.literal("generated"),
        v.literal("freesound"),
        v.literal("uploaded"),
      ),
    ),
    backgroundMusicPrompt: v.optional(v.string()),
    backgroundMusicMood: v.optional(v.string()),
    audioTrackSettings: v.optional(
      v.object({
        audioNarration: v.optional(
          v.object({
            volume: v.optional(v.number()),
            muted: v.optional(v.boolean()),
          }),
        ),
        audioBgm: v.optional(
          v.object({
            volume: v.optional(v.number()),
            muted: v.optional(v.boolean()),
          }),
        ),
        audioSfx: v.optional(
          v.object({
            volume: v.optional(v.number()),
            muted: v.optional(v.boolean()),
          }),
        ),
      }),
    ),
    compositionState: v.optional(v.any()),
    edl: v.optional(v.any()),
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
        responses: v.any(),
      }),
    ),
    generatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  scenes: defineTable({
    projectId: v.id("videoProjects"),
    sceneNumber: v.number(),
    description: v.string(), // Short narrative description for UI display
    visualPrompt: v.optional(v.string()), // Detailed 150-250 word prompt for video generation
    redesignShotId: v.optional(v.id("sceneShots")),
    imageStorageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    narrationUrl: v.optional(v.string()),
    narrationText: v.optional(v.string()),
    voiceId: v.optional(v.string()),
    voiceName: v.optional(v.string()),
    duration: v.number(),
    lipsyncVideoUrl: v.optional(v.string()),
    lipsyncStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    lipsyncPredictionId: v.optional(v.string()),
    replicateImageId: v.optional(v.string()),
    backgroundMusicUrl: v.optional(v.string()),
    backgroundMusicSource: v.optional(
      v.union(
        v.literal("generated"),
        v.literal("freesound"),
        v.literal("uploaded"),
      ),
    ),
    backgroundMusicPrompt: v.optional(v.string()),
    backgroundMusicMood: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_redesignShot", ["redesignShotId"]),

  projectVoiceSettings: defineTable({
    projectId: v.id("videoProjects"),
    selectedVoiceId: v.string(),
    selectedVoiceName: v.string(),
    voiceReasoning: v.optional(v.string()),
    emotion: v.optional(v.string()),
    speed: v.optional(v.number()),
    pitch: v.optional(v.number()),
    voiceProvider: v.optional(
      v.union(v.literal("replicate"), v.literal("elevenlabs")),
    ),
    voiceModelKey: v.optional(v.string()),
    providerVoiceId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  videoClips: defineTable({
    sceneId: v.id("scenes"),
    projectId: v.id("videoProjects"),
    videoUrl: v.optional(v.string()),
    proxyUrl: v.optional(v.string()),
    r2Key: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
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
    lipsyncVideoUrl: v.optional(v.string()),
    originalVideoUrl: v.optional(v.string()),
    hasLipsync: v.optional(v.boolean()),
    cancelledAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_project", ["projectId"]),

  editorProjects: defineTable({
    userId: v.string(),
    title: v.optional(v.string()),
    projectData: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  projectHistory: defineTable({
    projectId: v.string(),
    userId: v.string(),
    snapshot: v.any(),
    historyType: v.union(v.literal("past"), v.literal("future")),
    sequenceNumber: v.number(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId", "historyType", "sequenceNumber"])
    .index("by_user", ["userId", "createdAt"]),

  audioAssets: defineTable({
    projectId: v.id("videoProjects"),
    sceneId: v.optional(v.id("scenes")),
    type: v.union(
      v.literal("bgm"),
      v.literal("sfx"),
      v.literal("narration"),
      v.literal("voiceover"),
    ),
    source: v.union(
      v.literal("generated"),
      v.literal("freesound"),
      v.literal("uploaded"),
      v.literal("external"),
    ),
    provider: v.optional(v.string()),
    modelKey: v.optional(v.string()),
    url: v.string(),
    duration: v.optional(v.number()),
    prompt: v.optional(v.string()),
    mood: v.optional(v.string()),
    timelineStart: v.optional(v.number()),
    timelineEnd: v.optional(v.number()),
    beatMarkers: v.optional(v.array(beatMarkerValidator)),
    bpm: v.optional(v.number()),
    beatAnalysisStatus: v.optional(
      v.union(
        v.literal("not_analyzed"),
        v.literal("analyzing"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("rate_limited"),
      ),
    ),
    analysisError: v.optional(v.string()),
    analysisMethod: v.optional(
      v.union(
        v.literal("replicate"),
        v.literal("client"),
        v.literal("manual"),
      ),
    ),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_scene", ["sceneId"]),

  projectScenes: defineTable({
    projectId: v.id("videoProjects"),
    sceneNumber: v.number(),
    title: v.string(),
    description: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId", "sceneNumber"]),

  projectAssets: defineTable({
    projectId: v.id("videoProjects"),
    assetType: v.union(
      v.literal("logo"),
      v.literal("product"),
      v.literal("character"),
      v.literal("background"),
      v.literal("prop"),
      v.literal("reference"),
      v.literal("other"),
    ),
    name: v.string(),
    description: v.optional(v.string()),
    usageNotes: v.optional(v.string()),
    prominence: v.optional(
      v.union(
        v.literal("primary"),
        v.literal("secondary"),
        v.literal("subtle"),
      ),
    ),
    referenceColors: v.optional(v.array(v.string())),
    img2imgStrength: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_active", ["projectId", "isActive"]),

  projectScenesAssets: defineTable({
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    assetId: v.id("projectAssets"),
    usage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_project", ["projectId"]),

  sceneShots: defineTable({
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotNumber: v.number(),
    title: v.optional(v.string()),
    description: v.string(),
    cameraDirection: v.optional(v.string()),
    cameraShotType: v.optional(v.string()),
    cameraLens: v.optional(v.string()),
    cameraMovement: v.optional(v.string()),
    lightingStyle: v.optional(v.string()),
    mood: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
    resolution: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    voiceoverScript: v.optional(v.string()),
    usedAssets: v.optional(v.array(v.id("projectAssets"))),
    referencedAssets: v.optional(v.array(v.id("projectAssets"))),
    linkedShotId: v.optional(v.union(v.id("sceneShots"), v.null())),
    linkedImageId: v.optional(v.union(v.id("shotImages"), v.null())),
    sourcePromptVersion: v.optional(v.number()),
    initialPrompt: v.optional(v.string()),
    selectedImageId: v.optional(v.id("shotImages")),
    lastImageGenerationAt: v.optional(v.number()),
    lastImageStatus: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scene", ["sceneId", "shotNumber"])
    .index("by_project", ["projectId"]),

  shotImages: defineTable({
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotId: v.id("sceneShots"),
    iterationNumber: v.number(),
    variantNumber: v.number(),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.string()),
    iterationPrompt: v.string(),
    parentImageId: v.optional(v.id("shotImages")),
    replicateImageId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    isFavorite: v.boolean(),
    usedAssets: v.optional(v.array(v.id("projectAssets"))),
    sourcePromptVersion: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_shot", ["shotId", "iterationNumber", "variantNumber"])
    .index("by_scene", ["sceneId"])
    .index("by_project", ["projectId"]),

  storyboardSelections: defineTable({
    projectId: v.id("videoProjects"),
    sceneId: v.id("projectScenes"),
    shotId: v.id("sceneShots"),
    selectedImageId: v.id("shotImages"),
    animationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    animatedVideoUrl: v.optional(v.string()),
    replicateVideoId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_scene", ["sceneId"])
    .index("by_shot", ["shotId"]),

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
      v.literal("cancelled"),
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  assets: defineTable({
    userId: v.string(),
    projectId: v.optional(v.id("videoProjects")),
    sceneId: v.optional(v.id("scenes")),
    replicateId: v.optional(v.string()),
    predictionId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
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
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_scene", ["sceneId"])
    .index("by_key", ["r2Key"])
    .index("by_prediction", ["predictionId"])
    .index("by_replicate", ["replicateId"]),
});
