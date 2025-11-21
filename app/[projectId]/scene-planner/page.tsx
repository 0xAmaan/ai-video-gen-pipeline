"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRight, RefreshCw, GripVertical } from "lucide-react";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { PromptPlannerCard } from "@/components/redesign/PromptPlannerCard";
import { ChatInput } from "@/components/redesign/ChatInput";
import { VerticalMediaGallery } from "@/components/redesign/VerticalMediaGallery";
import { AssetManager } from "@/components/redesign/AssetManager";
import { SceneIteratorModal } from "@/components/redesign/SceneIteratorModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useProjectScenes,
  useSceneShots,
  useCreateProjectScene,
  useDeleteProjectScene,
  useUpdateProjectScene,
  useReorderScenes,
  useCreateSceneShot,
  useDeleteSceneShot,
  useUpdateSceneShot,
  useReorderSceneShots,
  useMoveShotToScene,
  useProjectProgress,
  useRedesignProject,
  useShotPreviewImages,
  useSelectMasterShot,
  useAllMasterShotsSet,
} from "@/lib/hooks/useProjectRedesign";
import { requestPreviewSeed } from "@/lib/client/requestPreviewSeed";
import {
  ProjectScene,
  SceneShot,
  ShotSelectionSummary,
  ShotPreviewImage,
} from "@/lib/types/redesign";

type PlannerSceneState = ProjectScene & {
  shots: SceneShot[];
  isExpanded: boolean;
};

const SceneShotsSynchronizer = ({
  sceneId,
  onSync,
}: {
  sceneId: Id<"projectScenes">;
  onSync: (sceneId: Id<"projectScenes">, shots: SceneShot[]) => void;
}) => {
  const shots = useSceneShots(sceneId);

  useEffect(() => {
    if (!shots) return;
    onSync(sceneId, shots);
  }, [sceneId, shots, onSync]);

  return null;
};

const PromptPlannerPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;

  const projectScenes = useProjectScenes(projectId);
  const projectProgress = useProjectProgress(projectId);
  const projectData = useRedesignProject(projectId);
  const shotPreviewGroups = useShotPreviewImages(projectId);
  const selectMasterShot = useSelectMasterShot();
  const allMasterShotsSet = useAllMasterShotsSet(projectId);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);

  const createScene = useCreateProjectScene();
  const updateScene = useUpdateProjectScene();
  const deleteScene = useDeleteProjectScene();
  const reorderScenes = useReorderScenes();

  const createShot = useCreateSceneShot();
  const updateShot = useUpdateSceneShot();
  const deleteShot = useDeleteSceneShot();
  const reorderSceneShots = useReorderSceneShots();
  const moveShotToScene = useMoveShotToScene();

  const [plannerScenes, setPlannerScenes] = useState<PlannerSceneState[]>([]);
  const [chatInputValue, setChatInputValue] = useState("");
  const [selectedShot, setSelectedShot] = useState<{
    shotId: Id<"sceneShots">;
    sceneId: Id<"projectScenes">;
  } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<"scene" | "shot" | null>(null);
  const [highlightedShotId, setHighlightedShotId] = useState<
    Id<"sceneShots"> | null
  >(null);
  const [regenerateTarget, setRegenerateTarget] = useState<SceneShot | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
  const [regenerateBusy, setRegenerateBusy] = useState(false);
  const [seedingMissing, setSeedingMissing] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [iteratorShotId, setIteratorShotId] = useState<Id<"sceneShots"> | null>(null);

  const shotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const registerShotRef = useCallback(
    (shotId: Id<"sceneShots">, node: HTMLDivElement | null) => {
      shotRefs.current[shotId] = node;
    },
    [],
  );

  const shotPreviewMap = useMemo(() => {
    const map = new Map<Id<"sceneShots">, ShotPreviewImage[]>();
    shotPreviewGroups?.forEach((group) => {
      map.set(group.shotId, group.images);
    });
    return map;
  }, [shotPreviewGroups]);

  const missingPreviewCount = useMemo(() => {
    return plannerScenes.reduce(
      (sum, scene) =>
        sum +
        scene.shots.filter(
          (shot) => (shotPreviewMap.get(shot._id)?.length ?? 0) === 0,
        ).length,
      0,
    );
  }, [plannerScenes, shotPreviewMap]);

  useEffect(() => {
    if (!projectScenes) return;

    // If we were generating and now have scenes, generation is complete
    if (isGeneratingScenes && projectScenes.length > 0) {
      setIsGeneratingScenes(false);
      toast.success(`Generated ${projectScenes.length} scenes with AI!`);
    }

    setPlannerScenes((prev) => {
      const previousState = new Map(prev.map((scene) => [scene._id, scene]));
      return projectScenes
        .map((scene) => ({
          ...scene,
          shots: previousState.get(scene._id)?.shots ?? [],
          isExpanded: previousState.get(scene._id)?.isExpanded ?? true,
        }))
        .sort((a, b) => a.sceneNumber - b.sceneNumber);
    });
  }, [projectScenes, isGeneratingScenes]);

  // Detect if we should show generating state on initial load
  useEffect(() => {
    if (projectScenes !== undefined && projectScenes.length === 0 && projectData) {
      // Check if there's promptPlannerData (initial ideas) but no scenes yet
      // This indicates generation might be in progress
      const hasInitialIdeas = projectData.promptPlannerData && projectData.promptPlannerData.trim().length > 0;

      if (hasInitialIdeas) {
        // Small delay to let the background request start
        setTimeout(() => {
          if (projectScenes?.length === 0) {
            // Still no scenes, generation is likely in progress
            setIsGeneratingScenes(true);
          }
        }, 300);
      }
    }
  }, [projectId, projectScenes, projectData]);

  const handleSceneShotsUpdate = useCallback(
    (sceneId: Id<"projectScenes">, shots: SceneShot[]) => {
      setPlannerScenes((prev) =>
        prev.map((scene) =>
          scene._id === sceneId
            ? {
                ...scene,
                shots: [...shots].sort(
                  (a, b) => (a.shotNumber ?? 0) - (b.shotNumber ?? 0),
                ),
              }
            : scene,
        ),
      );
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 3 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleToggleExpand = (sceneId: Id<"projectScenes">) => {
    setPlannerScenes((prev) =>
      prev.map((scene) =>
        scene._id === sceneId ? { ...scene, isExpanded: !scene.isExpanded } : scene,
      ),
    );
  };

  const createDefaultShot = async (sceneId: Id<"projectScenes">) => {
    await createShot({
      projectId: projectId as Id<"videoProjects">,
      sceneId,
      shotNumber: 1,
      description: "Describe your shot here...",
      initialPrompt: "Describe your shot here...",
    });
  };

  const handleAddScene = async () => {
    if (!projectId) return;
    const nextSceneNumber =
      plannerScenes.reduce((max, scene) => Math.max(max, scene.sceneNumber), 0) +
      1;

    const sceneId = await createScene({
      projectId,
      sceneNumber: nextSceneNumber,
      title: `Scene ${nextSceneNumber}`,
      description: "Describe your scene here...",
    });

    await createDefaultShot(sceneId);
  };

  const handleAddSceneBelow = async (currentSceneId: Id<"projectScenes">) => {
    if (!projectId) return;

    // Find the current scene's position
    const currentSceneIndex = plannerScenes.findIndex(
      (s) => s._id === currentSceneId,
    );
    if (currentSceneIndex === -1) return;

    // Calculate the new scene number (insert after current scene)
    const newSceneNumber = plannerScenes[currentSceneIndex].sceneNumber + 1;

    // Create the new scene
    const newSceneId = await createScene({
      projectId,
      sceneNumber: newSceneNumber,
      title: `Scene ${newSceneNumber}`,
      description: "Describe your scene here...",
    });

    await createDefaultShot(newSceneId);

    // Renumber subsequent scenes
    const scenesToReorder = plannerScenes
      .slice(currentSceneIndex + 1)
      .map((scene, idx) => ({
        sceneId: scene._id,
        sceneNumber: newSceneNumber + idx + 1,
      }));

    if (scenesToReorder.length > 0) {
      await reorderScenes({
        projectId,
        sceneOrders: scenesToReorder,
      });
    }
  };

  const handleDeleteScene = async (sceneId: Id<"projectScenes">) => {
    await deleteScene({ sceneId });
  };

  const handleUpdateSceneTitle = async (
    sceneId: Id<"projectScenes">,
    title: string,
  ) => {
    setPlannerScenes((prev) =>
      prev.map((scene) =>
        scene._id === sceneId ? { ...scene, title } : scene,
      ),
    );
    await updateScene({ sceneId, title });
  };

  const handleUpdateSceneDescription = async (
    sceneId: Id<"projectScenes">,
    description: string,
  ) => {
    setPlannerScenes((prev) =>
      prev.map((scene) =>
        scene._id === sceneId ? { ...scene, description } : scene,
      ),
    );
    await updateScene({ sceneId, description });
  };

  const handleAddShot = async (sceneId: Id<"projectScenes">) => {
    if (!projectId) return;

    const scene = plannerScenes.find((s) => s._id === sceneId);
    if (!scene) return;

    const nextShotNumber =
      scene.shots.reduce(
        (max, shot) => Math.max(max, shot.shotNumber ?? 0),
        0,
      ) + 1;

    await createShot({
      projectId,
      sceneId,
      shotNumber: nextShotNumber,
      description: "Describe your shot here...",
      initialPrompt: "Describe your shot here...",
    });
  };

  const handleDeleteShot = async (shotId: Id<"sceneShots">) => {
    await deleteShot({ shotId });
  };

  const handleUpdateShotText = async (
    shotId: Id<"sceneShots">,
    text: string,
  ) => {
    setPlannerScenes((prev) =>
      prev.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot) =>
          shot._id === shotId
            ? { ...shot, description: text, initialPrompt: text }
            : shot,
        ),
      })),
    );
    await updateShot({
      shotId,
      description: text,
      initialPrompt: text,
    });
  };

  const handleShotClick = (shot: SceneShot) => {
    console.log('[Scene-Planner] Shot clicked:', shot._id);
    setSelectedShot({ shotId: shot._id, sceneId: shot.sceneId });
    setChatInputValue(""); // Don't autofill - user types refinement command
    setHighlightedShotId(shot._id);
    console.log('[Scene-Planner] selectedShot updated, shouldFocus should be true');
  };

  const handleChatSubmit = async (message: string) => {
    if (!selectedShot || !projectId) return;

    const shot = plannerScenes
      .flatMap((scene) => scene.shots)
      .find((s) => s._id === selectedShot.shotId);

    if (!shot) return;

    try {
      // TODO: Decide on API integration approach for chat refinements
      // Option A: image + original description + command (CURRENT IMPLEMENTATION)
      //   - Sends: parentImageId, shot.description (via API server-side), fixPrompt
      //   - Pros: Full context for AI, maintains original intent
      //   - Cons: Description might conflict with refinement command
      //
      // Option B: image + command only
      //   - Sends: parentImageId, fixPrompt (no description context)
      //   - Pros: Clean, direct refinement without context conflicts
      //   - Cons: Loses original shot context and intent
      //
      // Option C: image + AI-regenerated description
      //   - Sends: parentImageId, AI-generated new description (command → new description first)
      //   - Pros: Description stays updated with changes, single source of truth
      //   - Cons: Requires extra AI call to rewrite description first, more complex flow

      toast.success("Regenerating shot...");

      const response = await fetch("/api/generate-shot-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneId: shot.sceneId,
          shotId: shot._id,
          fixPrompt: message.trim(),
          parentImageId: shot.selectedImageId, // Use current selected image for image-to-image
          mode: "preview",
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Generation failed");
      }

      setSelectedShot(null);
      setChatInputValue("");
    } catch (error) {
      console.error("Failed to regenerate shot", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to regenerate shot",
      );
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setActiveDragType(event.active.data.current?.type ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setActiveDragType(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;
    if (activeType === "scene") {
      const oldIndex = plannerScenes.findIndex(
        (scene) => scene._id === active.id,
      );
      const newIndex = plannerScenes.findIndex(
        (scene) => scene._id === over.id,
      );

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(plannerScenes, oldIndex, newIndex);
      setPlannerScenes(reordered);

      await reorderScenes({
        projectId: projectId as Id<"videoProjects">,
        sceneOrders: reordered.map((scene, index) => ({
          sceneId: scene._id,
          sceneNumber: index + 1,
        })),
      });
      return;
    }

    if (activeType === "shot") {
      const sourceSceneId = active.data.current?.sceneId as Id<"projectScenes">;
      let targetSceneId = over.data.current?.sceneId as Id<"projectScenes">;

      // If dropped over a scene (not a shot), use the scene as target
      if (!targetSceneId && over.data.current?.type === "scene") {
        targetSceneId = over.id as Id<"projectScenes">;
      }

      if (!sourceSceneId || !targetSceneId) return;

      const sourceScene = plannerScenes.find((s) => s._id === sourceSceneId);
      const targetScene = plannerScenes.find((s) => s._id === targetSceneId);
      if (!sourceScene || !targetScene) return;

      const oldIndex = sourceScene.shots.findIndex((shot) => shot._id === active.id);
      if (oldIndex === -1) return;

      // Same scene reordering
      if (sourceSceneId === targetSceneId) {
        const newIndex = sourceScene.shots.findIndex((shot) => shot._id === over.id);
        if (newIndex === -1) return;

        const updatedShots = arrayMove(sourceScene.shots, oldIndex, newIndex);
        setPlannerScenes((prev) =>
          prev.map((s) =>
            s._id === sourceScene._id ? { ...s, shots: updatedShots } : s,
          ),
        );

        await reorderSceneShots({
          sceneId: sourceScene._id,
          shotOrders: updatedShots.map((shot, index) => ({
            shotId: shot._id,
            shotNumber: index + 1,
          })),
        });
      } else {
        // Cross-scene shot movement
        const shotToMove = sourceScene.shots[oldIndex];
        const newIndex = targetScene.shots.findIndex((shot) => shot._id === over.id);

        // Remove from source scene
        const updatedSourceShots = sourceScene.shots.filter((_, idx) => idx !== oldIndex);

        // Add to target scene
        const updatedTargetShots = [...targetScene.shots];
        const insertIndex = newIndex === -1 ? updatedTargetShots.length : newIndex;
        updatedTargetShots.splice(insertIndex, 0, { ...shotToMove, sceneId: targetSceneId });

        // Update local state
        setPlannerScenes((prev) =>
          prev.map((s) => {
            if (s._id === sourceSceneId) {
              return { ...s, shots: updatedSourceShots };
            }
            if (s._id === targetSceneId) {
              return { ...s, shots: updatedTargetShots };
            }
            return s;
          }),
        );

        // Update backend - move shot to new scene
        await moveShotToScene({
          shotId: shotToMove._id,
          newSceneId: targetSceneId,
        });

        // Reorder shots in both scenes
        await Promise.all([
          reorderSceneShots({
            sceneId: sourceSceneId,
            shotOrders: updatedSourceShots.map((shot, index) => ({
              shotId: shot._id,
              shotNumber: index + 1,
            })),
          }),
          reorderSceneShots({
            sceneId: targetSceneId,
            shotOrders: updatedTargetShots.map((shot, index) => ({
              shotId: shot._id,
              shotNumber: index + 1,
            })),
          }),
        ]);

        toast.success(`Moved shot to ${targetScene.title}`);
      }
    }
  };

  const handleEnterIterator = (shot: SceneShot) => {
    setIteratorShotId(shot._id);
  };

  const handleSelectShotImage = async (
    shot: SceneShot,
    image: ShotPreviewImage,
  ) => {
    if (!projectId) return;
    try {
      await selectMasterShot({
        projectId,
        sceneId: shot.sceneId,
        shotId: shot._id,
        selectedImageId: image._id,
      });
      toast.success("Shot image selected");
      setHighlightedShotId(shot._id);
    } catch (error) {
      console.error("Failed to select shot image", error);
      toast.error("Could not select this image");
    }
  };

  const handleGeneratePreview = async (shot: SceneShot) => {
    if (!projectId) return;
    try {
      const response = await fetch("/api/generate-shot-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneId: shot.sceneId,
          shotId: shot._id,
          mode: "preview",
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Generation failed");
      }
      toast.success("Generating preview...");
    } catch (error) {
      console.error("Failed to generate preview", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to generate preview",
      );
    }
  };

  const handleOpenRegenerate = (shot: SceneShot) => {
    setRegenerateTarget(shot);
    setRegeneratePrompt(shot.description || "");
  };

  const handleRegenerateShot = async () => {
    if (!projectId || !regenerateTarget || regenerateBusy) return;
    setRegenerateBusy(true);
    try {
      const response = await fetch("/api/generate-shot-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneId: regenerateTarget.sceneId,
          shotId: regenerateTarget._id,
          fixPrompt: regeneratePrompt.trim() || undefined,
          mode: "preview",
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Generation failed");
      }
      toast.success("Regenerating images...");
      setRegenerateTarget(null);
      setRegeneratePrompt("");
    } catch (error) {
      console.error("Failed to regenerate shot", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to regenerate shot",
      );
    } finally {
      setRegenerateBusy(false);
    }
  };

  const handleSeedMissing = async () => {
    if (!projectId || seedingMissing) return;
    setSeedingMissing(true);
    setSeedError(null);
    try {
      const summary = await requestPreviewSeed(projectId);
      if (!summary.success) {
        setSeedError(
          summary.failures[0]?.reason ?? "Preview generation failed. Try again.",
        );
      } else {
        toast.success("Generating missing previews…");
      }
    } catch (error) {
      console.error("Failed to trigger preview seeding", error);
      setSeedError(
        error instanceof Error ? error.message : "Unable to trigger preview seeding",
      );
    } finally {
      setSeedingMissing(false);
    }
  };

  const handleGallerySelect = (selection: ShotSelectionSummary) => {
    const shotId = selection.shot._id;
    setHighlightedShotId(shotId);
    const node = shotRefs.current[shotId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const hasScenes = plannerScenes.length > 0;
  const selectionComplete = (projectProgress?.selectionProgress ?? 0) >= 100;

  const getActiveDragItem = () => {
    if (!activeDragId || !activeDragType) return null;

    if (activeDragType === "scene") {
      return plannerScenes.find((scene) => scene._id === activeDragId);
    }

    if (activeDragType === "shot") {
      for (const scene of plannerScenes) {
        const shot = scene.shots.find((s) => s._id === activeDragId);
        if (shot) {
          return { shot, scene };
        }
      }
    }

    return null;
  };

  const activeDragItem = getActiveDragItem();

  return (
    <>
      {plannerScenes.map((scene) => (
        <SceneShotsSynchronizer
          key={`shots-sync-${scene._id}`}
          sceneId={scene._id}
          onSync={handleSceneShotsUpdate}
        />
      ))}
      <div className="h-screen w-full bg-[var(--bg-base)] flex flex-col">
      <div className="flex-shrink-0 border-b border-gray-800 bg-[var(--bg-base)]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center gap-8">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Prompt Planner</h1>
            <p className="text-sm text-gray-400 mt-1">
              Map out your scenes and shots with AI-enhanced prompts
            </p>
          </div>

          <div className="flex-1 flex justify-center">
            <PageNavigation
              projectId={projectId}
              storyboardLocked={!allMasterShotsSet}
              storyboardLockMessage={
                !allMasterShotsSet
                  ? "Set up master shots for all scenes in Scene Planner"
                  : undefined
              }
            />
          </div>

          <div className="flex-1"></div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-auto pb-36 relative">
          <div className="max-w-7xl mx-auto px-8 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Brand Assets */}
                <div className="bg-[#101010] border border-white/10 rounded-3xl p-6">
                  <AssetManager projectId={projectId} />
                  {seedError && (
                    <p className="mt-3 text-sm text-red-400">
                      Preview generation issues: {seedError}
                    </p>
                  )}
                </div>

                {/* Scene Planner */}
                <div className="space-y-4">
              {!hasScenes ? (
                <div className="text-center py-20 border border-dashed border-gray-700 rounded-2xl w-full">
                  {isGeneratingScenes ? (
                    <>
                      <div className="flex justify-center mb-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                      </div>
                      <p className="text-white font-medium mb-2">
                        Generating your scenes...
                      </p>
                      <p className="text-gray-400 text-sm">
                        AI is creating a scene breakdown from your ideas. This takes 5-10 seconds.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-400 mb-4">
                        No scenes yet. Start mapping your story.
                      </p>
                      <Button onClick={handleAddScene} variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Scene
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <SortableContext
                  items={plannerScenes.map((scene) => scene._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {plannerScenes.map((scene, index) => {
                    const isLastScene = index === plannerScenes.length - 1;
                    return (
                      <div key={`scene-group-${scene._id}`} className="w-full">
                        <SortableContext
                          items={scene.shots.map((shot) => shot._id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <PromptPlannerCard
                            scene={scene}
                            sceneIndex={index}
                            shots={scene.shots}
                            isExpanded={scene.isExpanded}
                            activeShotId={highlightedShotId ?? selectedShot?.shotId}
                            onToggleExpand={handleToggleExpand}
                            onShotClick={handleShotClick}
                            onAddShot={handleAddShot}
                            onAddSceneBelow={handleAddSceneBelow}
                            onDeleteScene={handleDeleteScene}
                            onDeleteShot={handleDeleteShot}
                            onUpdateSceneTitle={handleUpdateSceneTitle}
                            onUpdateSceneDescription={handleUpdateSceneDescription}
                            onUpdateShotText={handleUpdateShotText}
                            onEnterIterator={handleEnterIterator}
                            registerShotRef={registerShotRef}
                            getShotPreviewImages={(shotId) =>
                              shotPreviewMap.get(shotId) ?? []
                            }
                            onSelectShotImage={handleSelectShotImage}
                            onRegenerateShot={handleOpenRegenerate}
                            onGeneratePreview={handleGeneratePreview}
                          />
                        </SortableContext>

                        {/* Only show Add Scene button after the last scene */}
                        {isLastScene && (
                          <Card className="mt-4 p-4 bg-[#171717] border border-gray-800 hover:border-gray-600/70 transition-all">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddSceneBelow(scene._id)}
                              className="w-full border-dashed border-gray-700 hover:border-gray-500 text-gray-300 hover:text-gray-100"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Scene
                            </Button>
                          </Card>
                        )}
                      </div>
                    );
                  })}
                </SortableContext>
              )}
                </div>
              </div>
          </div>

          {/* Fixed Thumbnail Sidebar */}
          <div className="hidden xl:block fixed right-0 top-0 bottom-0 w-72 overflow-y-auto p-6">
            <VerticalMediaGallery
              projectId={projectId}
              scenes={plannerScenes}
              activeShotId={highlightedShotId ?? selectedShot?.shotId}
              onSelect={handleGallerySelect}
            />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragItem && activeDragType === "scene" && (
            <Card className="p-4 bg-[#171717] border border-blue-500 shadow-2xl opacity-95 scale-105 rotate-2 pointer-events-none">
              <div className="flex items-center gap-3">
                <GripVertical className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-xl font-semibold text-white">
                    {(activeDragItem as PlannerSceneState).title}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {(activeDragItem as PlannerSceneState).shots.length} shot(s)
                  </p>
                </div>
              </div>
            </Card>
          )}
          {activeDragItem && activeDragType === "shot" && (
            <Card className="p-3 bg-[#131414] border border-blue-500 shadow-2xl opacity-95 scale-105 rotate-1 pointer-events-none">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <Badge variant="secondary" className="text-xs mb-2 bg-blue-500/15 text-blue-200 border-blue-500/30">
                    Shot {(activeDragItem as any).scene.sceneNumber}.{(activeDragItem as any).shot.shotNumber}
                  </Badge>
                  <p className="text-sm text-gray-200">
                    {(activeDragItem as any).shot.description.slice(0, 60)}...
                  </p>
                </div>
              </div>
            </Card>
          )}
        </DragOverlay>
      </DndContext>

      <div className="flex-shrink-0">
        <ChatInput
          onSubmit={(message) => {
            const trimmed = message.trim();
            if (trimmed.length) {
              handleChatSubmit(trimmed);
            }
          }}
          placeholder={
            selectedShot
              ? "Describe how you want to refine this shot..."
              : "Select a shot to edit its prompt..."
          }
          disabled={!selectedShot}
          initialMessage={chatInputValue}
          onMessageChange={setChatInputValue}
          shouldFocus={!!selectedShot}
          selectedShotId={selectedShot?.shotId}
        />
      </div>
      </div>

      <SceneIteratorModal
        projectId={projectId!}
        shotId={iteratorShotId}
        isOpen={!!iteratorShotId}
        onClose={() => setIteratorShotId(null)}
      />

      <Dialog
        open={!!regenerateTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRegenerateTarget(null);
            setRegeneratePrompt("");
          }
        }}
      >
        <DialogContent className="bg-[#111] border border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Regenerate shot images</DialogTitle>
            <DialogDescription className="text-gray-400">
              Describe what should change. We&apos;ll generate a new preview frame for{" "}
              {regenerateTarget
                ? `Shot ${regenerateTarget.shotNumber}`
                : "this shot"}{" "}
              using your guidance.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={regeneratePrompt}
            onChange={(e) => setRegeneratePrompt(e.target.value)}
            className="bg-[#1b1b1b] border-white/10 text-white min-h-[120px]"
            placeholder="e.g., make it dusk, add dramatic lighting..."
          />
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setRegenerateTarget(null);
                setRegeneratePrompt("");
              }}
              className="border-white/20 text-gray-300"
              disabled={regenerateBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateShot}
              disabled={regenerateBusy}
              className="bg-white text-black hover:bg-gray-200"
            >
              {regenerateBusy ? "Generating..." : "Generate preview frame"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PromptPlannerPage;
