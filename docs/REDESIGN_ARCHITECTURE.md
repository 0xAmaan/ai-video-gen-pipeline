# Video Pipeline Redesign Architecture

## Overview

This document describes the new v2 redesign architecture for the video pipeline project. The redesigned workflow provides a more structured approach to creating video projects with scenes, shots, and iterative image refinement.

## Database Schema

### New Tables

#### 1. `projectScenes`
Top-level scenes within a project (replaces legacy scenes concept).

**Fields:**
- `projectId` - Parent project reference
- `sceneNumber` - Display order (for sorting)
- `title` - Scene title (e.g., "Opening: The City Awakens")
- `description` - Scene narrative/context
- `createdAt`, `updatedAt` - Timestamps

**Indexes:**
- `by_project` on `[projectId, sceneNumber]`

#### 2. `sceneShots`
Individual shots within a scene (camera angles, moments).

**Fields:**
- `projectId` - For easy querying across project
- `sceneId` - Parent scene
- `shotNumber` - Order within scene
- `description` - Shot description/direction
- `initialPrompt` - Base prompt for first generation
- `selectedImageId` - Final chosen image for this shot
- `createdAt`, `updatedAt`

**Indexes:**
- `by_scene` on `[sceneId, shotNumber]`
- `by_project` on `projectId`

#### 3. `shotImages`
Image iterations for each shot (img2img refinement workflow).

**Fields:**
- `projectId`, `sceneId`, `shotId` - Hierarchy references
- `iterationNumber` - 0 = initial batch, 1+ = refinements
- `variantNumber` - 0-5 (six variants per iteration)
- `imageUrl` - Generated image URL
- `imageStorageId` - Convex storage ID
- `iterationPrompt` - Prompt used for this iteration
- `parentImageId` - Source image for img2img
- `replicateImageId` - Prediction tracking
- `status` - `pending | processing | complete | failed`
- `isFavorite` - User starred this variant
- `metadata` - Generation params (model, cfg_scale, etc.)
- `createdAt`, `updatedAt`

**Indexes:**
- `by_shot` on `[shotId, iterationNumber, variantNumber]`
- `by_scene` on `sceneId`
- `by_project` on `projectId`

#### 4. `storyboardSelections`
Final storyboard with master shots per scene.

**Fields:**
- `projectId`, `sceneId`, `shotId` - References
- `selectedImageId` - Master shot choice
- `animationStatus` - `pending | processing | complete | failed`
- `animatedVideoUrl` - Final animation
- `replicateVideoId` - Video generation tracking
- `createdAt`, `updatedAt`

**Indexes:**
- `by_project` on `projectId`
- `by_scene` on `sceneId`
- `by_shot` on `shotId`

### Extended `videoProjects` Table

**New Fields:**
- `workflowVersion` - `v1_legacy | v2_redesign`
- `promptPlannerData` - Brain dump from initial planning
- `redesignStatus` - Workflow state:
  - `prompt_planning` → `scenes_setup` → `shot_iteration` → `storyboard_final` → `animation_complete`

## Data Flow

### 1. Project Creation
```typescript
const projectId = await createRedesignProject({
  userId: "user_123",
  prompt: "A cinematic journey through Tokyo",
  title: "Tokyo Dreams",
  promptPlannerData: "Brain dump text here...",
});
```

### 2. Scene Setup
```typescript
const sceneId = await createProjectScene({
  projectId,
  sceneNumber: 1,
  title: "Opening: The City Awakens",
  description: "Dawn breaks over Tokyo skyline",
});
```

### 3. Shot Creation
```typescript
const shotId = await createSceneShot({
  projectId,
  sceneId,
  shotNumber: 1,
  description: "Wide shot of Tokyo Tower at sunrise",
  initialPrompt: "Cinematic wide shot, Tokyo Tower, golden hour lighting...",
});
```

### 4. Image Generation (Initial Batch)
```typescript
const imageIds = await batchCreateShotImages({
  projectId,
  sceneId,
  shotId,
  iterationNumber: 0,
  iterationPrompt: "Cinematic wide shot, Tokyo Tower...",
  images: [
    { variantNumber: 0, imageUrl: "https://...", status: "complete" },
    { variantNumber: 1, imageUrl: "https://...", status: "complete" },
    // ... 4 more variants
  ],
});
```

### 5. Image Iteration (Img2Img Refinement)
```typescript
// User selects favorite from iteration 0
const favoriteImage = images.find(img => img.variantNumber === 2);

// Generate next iteration based on selected image
const nextIterationIds = await batchCreateShotImages({
  projectId,
  sceneId,
  shotId,
  iterationNumber: 1,
  iterationPrompt: "Same composition, add more dramatic clouds",
  parentImageId: favoriteImage._id,
  images: [
    // 6 new variants based on parent image
  ],
});
```

### 6. Storyboard Selection
```typescript
// User selects final master shot
await createStoryboardSelection({
  projectId,
  sceneId,
  shotId,
  selectedImageId: finalChosenImageId,
});
```

### 7. Animation Generation
```typescript
await updateStoryboardAnimation({
  selectionId,
  animationStatus: "processing",
  replicateVideoId: "replicate_prediction_id",
});

// After completion
await updateStoryboardAnimation({
  selectionId,
  animationStatus: "complete",
  animatedVideoUrl: "https://...",
});
```

## React Hooks Usage

### Basic Hooks

```typescript
// Get project data
const project = useRedesignProject(projectId);

// Get all scenes
const scenes = useProjectScenes(projectId);

// Get shots for a scene
const shots = useSceneShots(sceneId);

// Get images for a shot
const images = useShotImages(shotId);

// Get storyboard selections
const selections = useStoryboardSelections(projectId);
```

### Mutations

```typescript
// Create entities
const createScene = useCreateProjectScene();
const createShot = useCreateSceneShot();
const createImage = useCreateShotImage();

// Update entities
const updateScene = useUpdateProjectScene();
const updateShot = useUpdateSceneShot();
const updateImage = useUpdateShotImage();

// Delete entities
const deleteScene = useDeleteProjectScene();
const deleteShot = useDeleteSceneShot();
const deleteImage = useDeleteShotImage();
```

### Composite Hooks (Higher-level operations)

```typescript
// Initialize project with prompt planner
const initializeProject = useInitializeProject();
await initializeProject({
  userId,
  prompt,
  promptPlannerData: "Brain dump...",
});

// Create scene with multiple shots
const createSceneWithShots = useCreateSceneWithShots();
await createSceneWithShots(
  {
    projectId,
    sceneNumber: 1,
    title: "Scene 1",
    description: "...",
  },
  [
    { shotNumber: 1, description: "Shot 1", initialPrompt: "..." },
    { shotNumber: 2, description: "Shot 2", initialPrompt: "..." },
  ],
);

// Select master shot and create storyboard
const selectMasterShot = useSelectMasterShot();
await selectMasterShot({
  projectId,
  sceneId,
  shotId,
  selectedImageId,
});
```

### Utility Hooks

```typescript
// Group images by iteration
const groupedImages = useGroupedShotImages(shotId);
// Returns: [
//   { iterationNumber: 0, images: [...], prompt: "...", parentImage: undefined },
//   { iterationNumber: 1, images: [...], prompt: "...", parentImage: {...} },
// ]

// Check storyboard completion
const isComplete = useSceneStoryboardComplete(sceneId);

// Get project progress
const progress = useProjectProgress(projectId);
// Returns: {
//   totalScenes: 5,
//   totalShots: 15,
//   shotsWithSelections: 10,
//   shotsWithAnimations: 5,
//   selectionProgress: 66.7,
//   animationProgress: 33.3,
//   isSelectionComplete: false,
//   isAnimationComplete: false,
// }
```

## Hierarchy

```
Project (videoProjects)
└── Scene (projectScenes)
    └── Shot (sceneShots)
        ├── Image Iteration 0 (shotImages)
        │   ├── Variant 0
        │   ├── Variant 1
        │   ├── Variant 2
        │   ├── Variant 3
        │   ├── Variant 4
        │   └── Variant 5
        ├── Image Iteration 1 (shotImages, based on selected variant from iteration 0)
        │   ├── Variant 0
        │   └── ... (6 variants)
        └── Storyboard Selection (storyboardSelections)
            └── Selected Master Image → Animation
```

## UI Flow

### 1. Prompt Planner Page
- User brain dumps project vision
- Saves to `promptPlannerData`
- Status: `prompt_planning`

### 2. Scenes Setup Page
- Create scenes with titles and descriptions
- Create shots for each scene with descriptions
- Status: `scenes_setup`

### 3. Scene Iterator Page
- For each shot:
  - Generate initial 6 images (iteration 0)
  - User selects favorite
  - Generate 6 new images based on favorite (iteration 1)
  - Repeat until satisfied
  - Mark final selection
- Status: `shot_iteration`

### 4. Storyboard Page
- View all scenes
- See selected master shot for each shot
- Queue animations
- Status: `storyboard_final` → `animation_complete`

## Migration Strategy

### Phase 1: Build New System (Current)
✅ Schema defined
✅ Functions created
✅ Types created
✅ Hooks created

### Phase 2: UI Implementation (Next)
- Build Prompt Planner UI
- Build Scenes Setup UI
- Build Scene Iterator UI
- Build Storyboard UI

### Phase 3: Integration
- Wire up with Replicate API for image generation
- Add img2img support
- Add animation generation

### Phase 4: Migration (Future)
- Create migration script
- Convert legacy projects to new format
- Deprecate old workflow

## Files Structure

```
/convex
  ├── schema.ts (Extended with new tables)
  └── projectRedesign.ts (All CRUD functions)

/lib
  ├── types/
  │   └── redesign.ts (TypeScript types)
  └── hooks/
      └── useProjectRedesign.ts (React hooks)

/app/project-redesign
  ├── prompt-planner/page.tsx
  ├── scenes-setup/page.tsx
  ├── scene-iterator/page.tsx
  └── storyboard/page.tsx
```

## Key Features

1. **Iterative Refinement**: Img2img workflow with parent tracking
2. **Batch Operations**: Generate 6 variants per iteration
3. **Favorites System**: Star images for easy filtering
4. **Progress Tracking**: Know exactly where you are in the workflow
5. **Separation of Concerns**: Clean data model with proper relationships
6. **Real-time Sync**: Convex handles all reactivity
7. **Type Safety**: Full TypeScript support
8. **Flexible Metadata**: Store generation params for debugging

## Best Practices

1. **Always use hooks**: Don't call Convex functions directly
2. **Batch operations**: Use `batchCreateShotImages` for efficiency
3. **Track iterations**: Use `getLatestIterationNumber` before creating new iteration
4. **Update status**: Keep `redesignStatus` in sync with workflow progress
5. **Clean up**: Delete scenes/shots cascade to all child entities
6. **Error handling**: Check for null/undefined before using query results

## Example: Complete Flow

```typescript
const ExampleComponent = () => {
  // 1. Create project
  const createProject = useCreateRedesignProject();
  const projectId = await createProject({
    userId: "user_123",
    prompt: "Tokyo dreams",
  });

  // 2. Create scene
  const createScene = useCreateProjectScene();
  const sceneId = await createScene({
    projectId,
    sceneNumber: 1,
    title: "Opening",
    description: "City awakens",
  });

  // 3. Create shot
  const createShot = useCreateSceneShot();
  const shotId = await createShot({
    projectId,
    sceneId,
    shotNumber: 1,
    description: "Wide shot",
    initialPrompt: "Tokyo Tower, sunrise...",
  });

  // 4. Generate initial images
  const batchCreate = useBatchCreateShotImages();
  await batchCreate({
    projectId,
    sceneId,
    shotId,
    iterationNumber: 0,
    iterationPrompt: "Tokyo Tower, sunrise...",
    images: [
      /* 6 variants */
    ],
  });

  // 5. Get images and let user select
  const images = useShotImages(shotId, 0);
  const favoriteId = images?.find((img) => img.variantNumber === 2)?._id;

  // 6. Create next iteration
  await batchCreate({
    projectId,
    sceneId,
    shotId,
    iterationNumber: 1,
    iterationPrompt: "Same but more dramatic",
    parentImageId: favoriteId,
    images: [
      /* 6 new variants */
    ],
  });

  // 7. Select master shot
  const selectMaster = useSelectMasterShot();
  await selectMaster({
    projectId,
    sceneId,
    shotId,
    selectedImageId: finalImageId,
  });

  // 8. Check progress
  const progress = useProjectProgress(projectId);
  console.log(`Selection: ${progress.selectionProgress}%`);
};
```

## Next Steps

1. Implement UI components for each workflow stage
2. Integrate with Replicate API for image generation
3. Add image-to-image functionality
4. Build animation queue system
5. Add export functionality for final videos
