import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  CreateProjectInput,
  CreateSceneInput,
  CreateShotInput,
  CreateImageInput,
  BatchCreateImagesInput,
  CreateStoryboardSelectionInput,
  UpdateSceneInput,
  UpdateShotInput,
  UpdateImageInput,
  UpdateStoryboardAnimationInput,
  SceneReorderItem,
  ShotWithSceneData,
  ShotSelectionSummary,
  StoryboardSceneGroup,
  ProjectAsset,
  ShotPreviewGroup,
} from "@/lib/types/redesign";

// ========================================
// Project Hooks
// ========================================

export const useProjectAssets = (
  projectId?: Id<"videoProjects">,
  options?: { includeInactive?: boolean },
) => {
  return useQuery(
    api.projectAssets.getProjectAssets,
    projectId
      ? {
          projectId,
          includeInactive: options?.includeInactive,
        }
      : "skip",
  ) as ProjectAsset[] | undefined;
};

export const useCreateProjectAsset = () => {
  return useMutation(api.projectAssets.createProjectAsset);
};

export const useUpdateProjectAsset = () => {
  return useMutation(api.projectAssets.updateProjectAsset);
};

export const useToggleProjectAsset = () => {
  return useMutation(api.projectAssets.toggleAssetActive);
};

export const useDeleteProjectAsset = () => {
  return useMutation(api.projectAssets.deleteProjectAsset);
};

export const useAssetsForShot = (
  projectId?: Id<"videoProjects">,
  options?: { includeInactive?: boolean },
) => {
  return useQuery(
    api.projectAssets.getAssetsForShot,
    projectId
      ? {
          projectId,
          includeInactive: options?.includeInactive,
        }
      : "skip",
  ) as ProjectAsset[] | undefined;
};

export const useShotPreviewImages = (projectId?: Id<"videoProjects">) => {
  return useQuery(
    api.projectRedesign.getShotPreviewImages,
    projectId ? { projectId } : "skip",
  ) as ShotPreviewGroup[] | undefined;
};

export const useCreateRedesignProject = () => {
  return useMutation(api.projectRedesign.createRedesignProject);
};

export const useUpdatePromptPlanner = () => {
  return useMutation(api.projectRedesign.updatePromptPlanner);
};

export const useUpdateRedesignStatus = () => {
  return useMutation(api.projectRedesign.updateRedesignStatus);
};

export const useRedesignProject = (projectId?: Id<"videoProjects">) => {
  return useQuery(
    api.projectRedesign.getRedesignProject,
    projectId ? { projectId } : "skip",
  );
};

export const useCompleteProject = (projectId?: Id<"videoProjects">) => {
  return useQuery(
    api.projectRedesign.getCompleteProject,
    projectId ? { projectId } : "skip",
  );
};

// ========================================
// Scene Hooks
// ========================================

export const useCreateProjectScene = () => {
  return useMutation(api.projectRedesign.createProjectScene);
};

export const useUpdateProjectScene = () => {
  return useMutation(api.projectRedesign.updateProjectScene);
};

export const useDeleteProjectScene = () => {
  return useMutation(api.projectRedesign.deleteProjectScene);
};

export const useReorderScenes = () => {
  return useMutation(api.projectRedesign.reorderScenes);
};

export const useProjectScenes = (projectId?: Id<"videoProjects">) => {
  return useQuery(
    api.projectRedesign.getProjectScenes,
    projectId ? { projectId } : "skip",
  );
};

// ========================================
// Shot Hooks
// ========================================

export const useCreateSceneShot = () => {
  return useMutation(api.projectRedesign.createSceneShot);
};

export const useUpdateSceneShot = () => {
  return useMutation(api.projectRedesign.updateSceneShot);
};

export const useDeleteSceneShot = () => {
  return useMutation(api.projectRedesign.deleteSceneShot);
};

export const useReorderSceneShots = () => {
  return useMutation(api.projectRedesign.reorderSceneShots);
};

export const useMoveShotToScene = () => {
  return useMutation(api.projectRedesign.moveShotToScene);
};

export const useClearShotImage = () => {
  return useMutation(api.projectRedesign.clearShotImage);
};

export const useSceneShots = (sceneId?: Id<"projectScenes">) => {
  return useQuery(
    api.projectRedesign.getSceneShots,
    sceneId ? { sceneId } : "skip",
  );
};

export const useShotWithScene = (shotId?: Id<"sceneShots">) => {
  return useQuery(
    api.projectRedesign.getShotWithScene,
    shotId ? { shotId } : "skip",
  ) as ShotWithSceneData | null;
};

// ========================================
// Image Hooks
// ========================================

export const useCreateShotImage = () => {
  return useMutation(api.projectRedesign.createShotImage);
};

export const useUpdateShotImage = () => {
  return useMutation(api.projectRedesign.updateShotImage);
};

export const useToggleShotImageFavorite = () => {
  return useMutation(api.projectRedesign.toggleShotImageFavorite);
};

export const useDeleteShotImage = () => {
  return useMutation(api.projectRedesign.deleteShotImage);
};

export const useBatchCreateShotImages = () => {
  return useMutation(api.projectRedesign.batchCreateShotImages);
};

export const useShotImages = (
  shotId?: Id<"sceneShots">,
  iterationNumber?: number,
) => {
  return useQuery(
    api.projectRedesign.getShotImages,
    shotId ? { shotId, iterationNumber } : "skip",
  );
};

export const useShotImagesByScene = (sceneId?: Id<"projectScenes">) => {
  return useQuery(
    api.projectRedesign.getShotImagesByScene,
    sceneId ? { sceneId } : "skip",
  );
};

export const useLatestIterationNumber = (shotId?: Id<"sceneShots">) => {
  return useQuery(
    api.projectRedesign.getLatestIterationNumber,
    shotId ? { shotId } : "skip",
  );
};

// ========================================
// Storyboard Hooks
// ========================================

export const useCreateStoryboardSelection = () => {
  return useMutation(api.projectRedesign.createStoryboardSelection);
};

export const useUpdateStoryboardAnimation = () => {
  return useMutation(api.projectRedesign.updateStoryboardAnimation);
};

export const useStoryboardSelections = (projectId?: Id<"videoProjects">) => {
  return useQuery(
    api.projectRedesign.getStoryboardSelections,
    projectId ? { projectId } : "skip",
  );
};

export const useStoryboardByScene = (sceneId?: Id<"projectScenes">) => {
  return useQuery(
    api.projectRedesign.getStoryboardByScene,
    sceneId ? { sceneId } : "skip",
  );
};

export const useProjectShotSelections = (projectId?: Id<"videoProjects">) => {
  return useQuery(
    api.projectRedesign.getProjectShotSelections,
    projectId ? { projectId } : "skip",
  ) as ShotSelectionSummary[] | undefined;
};

export const useStoryboardRows = (projectId?: Id<"videoProjects">) => {
  return useQuery(
    api.projectRedesign.getStoryboardRows,
    projectId ? { projectId } : "skip",
  ) as StoryboardSceneGroup[] | undefined;
};

/**
 * Check if all shots have master shots selected (for storyboard lock)
 */
export const useAllMasterShotsSet = (projectId?: Id<"videoProjects">) => {
  const storyboardRows = useStoryboardRows(projectId);

  if (!storyboardRows || storyboardRows.length === 0) {
    return false;
  }

  return storyboardRows.every((row) =>
    row.shots.every((shotData) => shotData.selectedImage !== null),
  );
};

// ========================================
// Composite Hooks (Higher-level operations)
// ========================================

/**
 * Create a new project and initialize with prompt planner data
 */
export const useInitializeProject = () => {
  const createProject = useCreateRedesignProject();
  const updatePromptPlanner = useUpdatePromptPlanner();

  return async (input: CreateProjectInput) => {
    const projectId = await createProject(input);

    if (input.promptPlannerData) {
      await updatePromptPlanner({
        projectId,
        promptPlannerData: input.promptPlannerData,
      });
    }

    return projectId;
  };
};

/**
 * Create a scene with multiple shots
 */
export const useCreateSceneWithShots = () => {
  const createScene = useCreateProjectScene();
  const createShot = useCreateSceneShot();

  return async (
    sceneInput: CreateSceneInput,
    shotsInput: Omit<CreateShotInput, "projectId" | "sceneId">[],
  ) => {
    const sceneId = await createScene(sceneInput);

    const shotIds = await Promise.all(
      shotsInput.map((shot) =>
        createShot({
          ...shot,
          projectId: sceneInput.projectId,
          sceneId,
        }),
      ),
    );

    return { sceneId, shotIds };
  };
};

/**
 * Generate initial images for a shot
 */
export const useGenerateInitialImages = () => {
  const batchCreate = useBatchCreateShotImages();

  return async (input: BatchCreateImagesInput) => {
    return await batchCreate(input);
  };
};

/**
 * Create next iteration of images based on selected parent
 */
export const useCreateNextIteration = () => {
  const batchCreate = useBatchCreateShotImages();
  const latestIteration = useLatestIterationNumber();

  return async (
    shotId: Id<"sceneShots">,
    input: Omit<BatchCreateImagesInput, "iterationNumber">,
  ) => {
    const currentIteration = latestIteration ?? -1;

    return await batchCreate({
      ...input,
      iterationNumber: currentIteration + 1,
    });
  };
};

/**
 * Select an image and create/update storyboard selection
 */
export const useSelectMasterShot = () => {
  const createSelection = useCreateStoryboardSelection();
  const updateShot = useUpdateSceneShot();

  return async (input: CreateStoryboardSelectionInput) => {
    // Update shot's selectedImageId
    await updateShot({
      shotId: input.shotId,
      selectedImageId: input.selectedImageId,
    });

    // Create/update storyboard selection
    return await createSelection(input);
  };
};

// ========================================
// Utility Hooks
// ========================================

/**
 * Group shot images by iteration number
 */
export const useGroupedShotImages = (shotId?: Id<"sceneShots">) => {
  const images = useShotImages(shotId);

  if (!images) return null;

  const grouped = images.reduce(
    (acc, image) => {
      if (!acc[image.iterationNumber]) {
        acc[image.iterationNumber] = [];
      }
      acc[image.iterationNumber].push(image);
      return acc;
    },
    {} as Record<number, typeof images>,
  );

  return Object.entries(grouped)
    .map(([iterationNumber, imgs]) => ({
      iterationNumber: parseInt(iterationNumber),
      images: imgs.sort((a, b) => a.variantNumber - b.variantNumber),
      prompt: imgs[0]?.iterationPrompt || "",
      parentImage: imgs[0]?.parentImageId
        ? images.find((img) => img._id === imgs[0].parentImageId)
        : undefined,
    }))
    .sort((a, b) => a.iterationNumber - b.iterationNumber);
};

/**
 * Check if all shots in a scene have storyboard selections
 */
export const useSceneStoryboardComplete = (sceneId?: Id<"projectScenes">) => {
  const shots = useSceneShots(sceneId);
  const selections = useStoryboardByScene(sceneId);

  if (!shots || !selections) return null;

  return shots.length > 0 && shots.length === selections.length;
};

/**
 * Get project progress statistics
 */
export const useProjectProgress = (projectId?: Id<"videoProjects">) => {
  const completeData = useCompleteProject(projectId);

  if (!completeData) return null;

  const totalScenes = completeData.scenes.length;
  const totalShots = completeData.scenes.reduce(
    (sum, scene) => sum + scene.shots.length,
    0,
  );

  const shotsWithSelections = completeData.scenes.reduce(
    (sum, scene) =>
      sum + scene.shots.filter((shot) => shot.storyboardSelection).length,
    0,
  );

  const shotsWithAnimations = completeData.scenes.reduce(
    (sum, scene) =>
      sum +
      scene.shots.filter(
        (shot) => shot.storyboardSelection?.animationStatus === "complete",
      ).length,
    0,
  );

  return {
    totalScenes,
    totalShots,
    shotsWithSelections,
    shotsWithAnimations,
    selectionProgress:
      totalShots > 0 ? (shotsWithSelections / totalShots) * 100 : 0,
    animationProgress:
      totalShots > 0 ? (shotsWithAnimations / totalShots) * 100 : 0,
    isSelectionComplete: totalShots > 0 && shotsWithSelections === totalShots,
    isAnimationComplete: totalShots > 0 && shotsWithAnimations === totalShots,
  };
};
