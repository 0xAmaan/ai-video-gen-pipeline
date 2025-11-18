 Database Architecture Plan: Video Pipeline Redesign

 Strategy: Hybrid Approach with Future Migration Path

 Build the new workflow alongside existing tables, then migrate once stable.

 ---
 New Database Schema

 1. projectScenes (replaces current scenes table concept)

 New top-level scene entity within a project.

 Fields:
 - projectId (Id<"videoProjects">) - Parent project
 - sceneNumber (number) - Display order
 - title (string) - e.g., "Opening: The City Awakens"
 - description (string) - Scene narrative/context
 - createdAt, updatedAt (numbers)

 Indexes:
 - by_project on [projectId, sceneNumber]

 Relationship: One project → Many scenes

 ---
 2. sceneShots (NEW)

 Individual shots within a scene (camera angles, moments).

 Fields:
 - projectId (Id<"videoProjects">) - For easy querying
 - sceneId (Id<"projectScenes">) - Parent scene
 - shotNumber (number) - Order within scene
 - description (string) - Shot description/direction
 - initialPrompt (string) - Base prompt for first generation
 - selectedImageId (optional Id<"shotImages">) - Final chosen image
 - createdAt, updatedAt (numbers)

 Indexes:
 - by_scene on [sceneId, shotNumber]
 - by_project on projectId

 Relationship: One scene → Many shots

 ---
 3. shotImages (NEW)

 Image iterations for each shot (img2img refinement workflow).

 Fields:
 - projectId (Id<"videoProjects">)
 - sceneId (Id<"projectScenes">)
 - shotId (Id<"sceneShots">)
 - iterationNumber (number) - 0 = initial batch, 1+ = refinements
 - variantNumber (number) - 0-5 (six variants per iteration)
 - imageUrl (string) - Generated image URL
 - imageStorageId (optional string) - Convex storage ID
 - iterationPrompt (string) - Prompt used for this iteration
 - parentImageId (optional Id<"shotImages">) - Source image for img2img
 - replicateImageId (optional string) - Prediction tracking
 - status (union) - "pending" | "processing" | "complete" | "failed"
 - isFavorite (boolean) - User starred this variant
 - metadata (optional object) - Generation params (model, cfg_scale, etc.)
 - createdAt, updatedAt (numbers)

 Indexes:
 - by_shot on [shotId, iterationNumber, variantNumber]
 - by_scene on sceneId
 - by_project on projectId

 Relationship: One shot → Many images (6 per iteration × N iterations)

 ---
 4. storyboardSelections (NEW)

 Final storyboard with master shots per scene.

 Fields:
 - projectId (Id<"videoProjects">)
 - sceneId (Id<"projectScenes">)
 - shotId (Id<"sceneShots">)
 - selectedImageId (Id<"shotImages">) - Master shot choice
 - animationStatus (optional union) - "pending" | "processing" | "complete" 
 | "failed"
 - animatedVideoUrl (optional string) - Final animation
 - replicateVideoId (optional string)
 - createdAt, updatedAt (numbers)

 Indexes:
 - by_project on projectId
 - by_scene on sceneId

 Relationship: One-to-one with sceneShots (each shot has one master
 selection)

 ---
 5. Extend videoProjects table

 Add new workflow tracking fields:

 New Fields:
 - workflowVersion (optional union) - "v1_legacy" | "v2_redesign" -
 Distinguish old vs new
 - promptPlannerData (optional string) - Brain dump from initial planning
 - redesignStatus (optional union) - New workflow states:
   - "prompt_planning" → "scenes_setup" → "shot_iteration" → 
 "storyboard_final" → "animation_complete"

 Keep Existing Fields: All current fields remain for backwards compatibility

 ---
 Data Flow

 1. CREATE PROJECT
    └─> videoProjects (workflowVersion: "v2_redesign")

 2. PROMPT PLANNER
    └─> Update videoProjects.promptPlannerData (brain dump text)

 3. SCENES SETUP
    └─> Create projectScenes (title + description)
    └─> Create sceneShots per scene (description + initialPrompt)

 4. SCENE ITERATOR (per shot)
    └─> Generate 6 initial shotImages (iteration 0, variants 0-5)
    └─> User iterates:
        └─> Select favorite → Create 6 new shotImages (iteration N+1)
            using parentImageId for img2img
    └─> Repeat until satisfied
    └─> Update sceneShots.selectedImageId with final choice

 5. STORYBOARD VIEW
    └─> Query all sceneShots.selectedImageId per scene
    └─> Create storyboardSelections for animation queue
    └─> Trigger animation jobs → Update animatedVideoUrl

 6. FINAL OUTPUT
    └─> Assemble video from storyboardSelections.animatedVideoUrl

 ---
 Migration Strategy

 Phase 1: Build New Tables (Week 1-2)

 1. Add 4 new tables to convex/schema.ts
 2. Create CRUD functions in convex/projectRedesign.ts
 3. Build UI for new workflow in /app/project-redesign/*
 4. New projects use workflowVersion: "v2_redesign"

 Phase 2: Run Dual Systems (Week 3-4)

 - Legacy projects continue using videoProjects → scenes → videoClips
 - New projects use videoProjects → projectScenes → sceneShots → shotImages
 - Dashboard shows both project types

 Phase 3: Migration (Week 5+)

 - Create migration script to convert old projects:
   - Map scenes → projectScenes (1:1)
   - Map scenes → sceneShots (1:1, single shot per scene)
   - Map scene images → shotImages (iteration 0)
 - Archive old tables after migration complete

 ---
 Key Decisions

 ✅ Extend videoProjects - Reuse existing project container
 ✅ New tables for scenes/shots - Clean separation from legacy scenes
 ✅ Track workflow version - Enable dual operation
 ✅ Img2img tracking - parentImageId links iterations
 ✅ Storyboard as selection layer - Decouples planning from animation

 ---
 Implementation Files

 Schema: convex/schema.ts - Add 4 new tables
 Functions: convex/projectRedesign.ts - All new CRUD operations
 Types: lib/types/redesign.ts - TypeScript interfaces
 UI: /app/project-redesign/* - Already started

 ---
 Next Steps

 1. Add new schema tables to convex/schema.ts
 2. Create Convex functions for mutations/queries
 3. Build React hooks for data fetching
 4. Wire up UI components in /app/project-redesign/

 Would you like me to proceed with implementing this architecture?