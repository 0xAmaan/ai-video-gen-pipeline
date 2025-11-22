import { Id } from "@/convex/_generated/dataModel";

// ========================================
// Workflow Status Types
// ========================================

export type WorkflowVersion = "v1_legacy" | "v2_redesign";

export type RedesignStatus =
  | "prompt_planning"
  | "asset_upload"
  | "scenes_generating"
  | "scenes_setup"
  | "shot_iteration"
  | "storyboard_final"
  | "animation_complete";

export type ImageGenerationStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed";

export type AnimationStatus = "pending" | "processing" | "complete" | "failed";

// ========================================
// Project Types
// ========================================

export interface RedesignProject {
  _id: Id<"videoProjects">;
  _creationTime: number;
  userId: string;
  prompt: string;
  title?: string;
  workflowVersion?: WorkflowVersion;
  promptPlannerData?: string;
  redesignStatus?: RedesignStatus;
  createdAt: number;
  updatedAt: number;
}

// ========================================
// Asset Types
// ========================================

export type ProjectAssetType =
  | "logo"
  | "product"
  | "character"
  | "background"
  | "prop"
  | "reference"
  | "other";

export type AssetProminence = "primary" | "secondary" | "subtle";

export interface ProjectAsset {
  _id: Id<"projectAssets">;
  _creationTime: number;
  projectId: Id<"videoProjects">;
  assetType: ProjectAssetType;
  name: string;
  description?: string;
  usageNotes?: string;
  prominence?: AssetProminence;
  referenceColors?: string[];
  img2imgStrength?: number;
  storageId?: string;
  imageUrl?: string;
  isActive: boolean;
  metadata?: any;
  createdAt: number;
  updatedAt: number;
}

// ========================================
// Scene Types
// ========================================

export interface ProjectScene {
  _id: Id<"projectScenes">;
  _creationTime: number;
  projectId: Id<"videoProjects">;
  sceneNumber: number;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSceneWithShots extends ProjectScene {
  shots: SceneShotWithImages[];
}

// ========================================
// Shot Types
// ========================================

export interface SceneShot {
  _id: Id<"sceneShots">;
  _creationTime: number;
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotNumber: number;
  description: string;
  initialPrompt: string;
  selectedImageId?: Id<"shotImages">;
  referencedAssets?: Id<"projectAssets">[];
  linkedShotId?: Id<"sceneShots"> | null;
  linkedImageId?: Id<"shotImages"> | null;
  lastImageGenerationAt?: number;
  lastImageStatus?: ImageGenerationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SceneShotWithImages extends SceneShot {
  images: ShotImage[];
  storyboardSelection?: StoryboardSelection;
}

// ========================================
// Image Types
// ========================================

export interface ShotImage {
  _id: Id<"shotImages">;
  _creationTime: number;
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotId: Id<"sceneShots">;
  iterationNumber: number;
  variantNumber: number;
  imageUrl: string;
  imageStorageId?: string;
  iterationPrompt: string;
  parentImageId?: Id<"shotImages">;
  replicateImageId?: string;
  status: ImageGenerationStatus;
  isFavorite: boolean;
  usedAssets?: Id<"projectAssets">[];
  sourcePromptVersion?: number;
  metadata?: any;
  createdAt: number;
  updatedAt: number;
}

export interface ShotPreviewImage {
  _id: Id<"shotImages">;
  shotId: Id<"sceneShots">;
  imageUrl: string;
  status: ImageGenerationStatus;
  variantNumber: number;
}

export interface ShotPreviewGroup {
  shotId: Id<"sceneShots">;
  images: ShotPreviewImage[];
}

export interface ShotImagesByIteration {
  iterationNumber: number;
  prompt: string;
  images: ShotImage[];
  parentImage?: ShotImage;
}

export interface ShotWithSceneData {
  shot: SceneShot;
  scene: ProjectScene;
  images: ShotImage[];
  storyboardSelection?: StoryboardSelection | null;
}

// ========================================
// Storyboard Types
// ========================================

export interface StoryboardSelection {
  _id: Id<"storyboardSelections">;
  _creationTime: number;
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotId: Id<"sceneShots">;
  selectedImageId: Id<"shotImages">;
  animationStatus?: AnimationStatus;
  animatedVideoUrl?: string;
  replicateVideoId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoryboardSceneGroup {
  scene: ProjectScene;
  shots: Array<{
    shot: SceneShot;
    selectedImage?: ShotImage | null;
    selection?: StoryboardSelection | null;
  }>;
}

export interface ShotSelectionSummary {
  selection: StoryboardSelection;
  shot: SceneShot;
  scene: ProjectScene;
  image: ShotImage;
}

// ========================================
// Complete Project Data
// ========================================

export interface CompleteProjectData {
  project: RedesignProject;
  scenes: ProjectSceneWithShots[];
}

// ========================================
// Form Input Types
// ========================================

export interface CreateProjectInput {
  userId: string;
  prompt: string;
  title?: string;
  promptPlannerData?: string;
}

export interface CreateSceneInput {
  projectId: Id<"videoProjects">;
  sceneNumber: number;
  title: string;
  description: string;
}

export interface CreateShotInput {
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotNumber: number;
  description: string;
  initialPrompt: string;
  linkedShotId?: Id<"sceneShots"> | null;
  linkedImageId?: Id<"shotImages"> | null;
}

export interface CreateImageInput {
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotId: Id<"sceneShots">;
  iterationNumber: number;
  variantNumber: number;
  imageUrl: string;
  imageStorageId?: string;
  iterationPrompt: string;
  parentImageId?: Id<"shotImages">;
  replicateImageId?: string;
  status?: ImageGenerationStatus;
  isFavorite?: boolean;
  metadata?: any;
}

export interface BatchCreateImagesInput {
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotId: Id<"sceneShots">;
  iterationNumber: number;
  iterationPrompt: string;
  parentImageId?: Id<"shotImages">;
  images: Array<{
    variantNumber: number;
    imageUrl: string;
    imageStorageId?: string;
    replicateImageId?: string;
    status?: ImageGenerationStatus;
  }>;
}

export interface CreateStoryboardSelectionInput {
  projectId: Id<"videoProjects">;
  sceneId: Id<"projectScenes">;
  shotId: Id<"sceneShots">;
  selectedImageId: Id<"shotImages">;
}

// ========================================
// Update Input Types
// ========================================

export interface UpdateSceneInput {
  sceneId: Id<"projectScenes">;
  title?: string;
  description?: string;
}

export interface UpdateShotInput {
  shotId: Id<"sceneShots">;
  description?: string;
  initialPrompt?: string;
  selectedImageId?: Id<"shotImages">;
  linkedShotId?: Id<"sceneShots"> | null;
  linkedImageId?: Id<"shotImages"> | null;
}

export interface UpdateImageInput {
  imageId: Id<"shotImages">;
  imageUrl?: string;
  imageStorageId?: string;
  status?: ImageGenerationStatus;
  isFavorite?: boolean;
  metadata?: any;
}

export interface UpdateStoryboardAnimationInput {
  selectionId: Id<"storyboardSelections">;
  animationStatus?: AnimationStatus;
  animatedVideoUrl?: string;
  replicateVideoId?: string;
}

// ========================================
// UI State Types
// ========================================

export interface SceneIteratorState {
  shotId: Id<"sceneShots">;
  currentIteration: number;
  selectedVariant?: number;
  showFavoritesOnly: boolean;
}

export interface StoryboardViewState {
  selectedSceneId?: Id<"projectScenes">;
  animationQueue: Id<"storyboardSelections">[];
  isAnimating: boolean;
}

// ========================================
// Reorder Types
// ========================================

export interface SceneReorderItem {
  sceneId: Id<"projectScenes">;
  sceneNumber: number;
}

export interface ShotReorderItem {
  shotId: Id<"sceneShots">;
  shotNumber: number;
}
