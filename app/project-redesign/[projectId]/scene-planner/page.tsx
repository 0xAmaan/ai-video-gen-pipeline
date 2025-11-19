"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { Plus, ArrowRight } from "lucide-react";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { PromptPlannerCard } from "@/components/redesign/PromptPlannerCard";
import { ChatInput } from "@/components/redesign/ChatInput";
import { VerticalMediaGallery } from "@/components/redesign/VerticalMediaGallery";
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
  useProjectProgress,
  useRedesignProject,
} from "@/lib/hooks/useProjectRedesign";
import {
  ProjectScene,
  SceneShot,
  ShotSelectionSummary,
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
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);

  const createScene = useCreateProjectScene();
  const updateScene = useUpdateProjectScene();
  const deleteScene = useDeleteProjectScene();
  const reorderScenes = useReorderScenes();

  const createShot = useCreateSceneShot();
  const updateShot = useUpdateSceneShot();
  const deleteShot = useDeleteSceneShot();
  const reorderSceneShots = useReorderSceneShots();

  const [plannerScenes, setPlannerScenes] = useState<PlannerSceneState[]>([]);
  const [chatInputValue, setChatInputValue] = useState("");
  const [selectedShot, setSelectedShot] = useState<{
    shotId: Id<"sceneShots">;
    sceneId: Id<"projectScenes">;
  } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [highlightedShotId, setHighlightedShotId] = useState<
    Id<"sceneShots"> | null
  >(null);

  const shotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const registerShotRef = useCallback(
    (shotId: Id<"sceneShots">, node: HTMLDivElement | null) => {
      shotRefs.current[shotId] = node;
    },
    [],
  );

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
      activationConstraint: { distance: 8 },
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

  const handleAddScene = async () => {
    if (!projectId) return;
    const nextSceneNumber =
      plannerScenes.reduce((max, scene) => Math.max(max, scene.sceneNumber), 0) +
      1;

    await createScene({
      projectId,
      sceneNumber: nextSceneNumber,
      title: `Scene ${nextSceneNumber}`,
      description: "Describe your scene here...",
    });
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
    setSelectedShot({ shotId: shot._id, sceneId: shot.sceneId });
    setChatInputValue(shot.description);
    setHighlightedShotId(shot._id);
  };

  const handleChatSubmit = async (message: string) => {
    if (!selectedShot) return;
    await handleUpdateShotText(selectedShot.shotId, message);
    setSelectedShot(null);
    setChatInputValue("");
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
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
      const targetSceneId = over.data.current?.sceneId as Id<"projectScenes">;
      if (!sourceSceneId || sourceSceneId !== targetSceneId) return;

      const scene = plannerScenes.find((s) => s._id === sourceSceneId);
      if (!scene) return;

      const oldIndex = scene.shots.findIndex((shot) => shot._id === active.id);
      const newIndex = scene.shots.findIndex((shot) => shot._id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const updatedShots = arrayMove(scene.shots, oldIndex, newIndex);
      setPlannerScenes((prev) =>
        prev.map((s) =>
          s._id === scene._id ? { ...s, shots: updatedShots } : s,
        ),
      );

      await reorderSceneShots({
        sceneId: scene._id,
        shotOrders: updatedShots.map((shot, index) => ({
          shotId: shot._id,
          shotNumber: index + 1,
        })),
      });
    }
  };

  const handleEnterIterator = (shot: SceneShot) => {
    if (!projectId) return;
    router.push(
      `/project-redesign/${projectId}/scene-iterator?shotId=${shot._id}`,
    );
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
        <div className="max-w-7xl mx-auto px-8 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Prompt Planner</h1>
            <p className="text-sm text-gray-400 mt-1">
              Map out your scenes and shots with AI-enhanced prompts
            </p>
          </div>

          <PageNavigation projectId={projectId} />

          <div className="flex items-center gap-3">
            {selectionComplete && projectId && (
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/project-redesign/${projectId}/storyboard`)
                }
                className="border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/10"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Go to Storyboard
              </Button>
            )}

            <Button
              onClick={handleAddScene}
              className="bg-white text-black hover:bg-gray-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Scene
            </Button>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-auto pb-36">
          <div className="max-w-7xl mx-auto px-8 py-6 flex gap-8">
            <div className="flex-1 space-y-4 flex flex-col items-center">
              {!hasScenes ? (
                <div className="text-center py-20 border border-dashed border-gray-700 rounded-2xl w-full max-w-2xl">
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
                  {plannerScenes.map((scene, index) => (
                    <SortableContext
                      key={scene._id}
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
                        onDeleteScene={handleDeleteScene}
                        onDeleteShot={handleDeleteShot}
                        onUpdateSceneTitle={handleUpdateSceneTitle}
                        onUpdateSceneDescription={handleUpdateSceneDescription}
                        onUpdateShotText={handleUpdateShotText}
                        onEnterIterator={handleEnterIterator}
                        registerShotRef={registerShotRef}
                      />
                    </SortableContext>
                  ))}
                </SortableContext>
              )}
            </div>

            <div className="hidden xl:block w-72">
              <VerticalMediaGallery
                projectId={projectId}
                activeShotId={highlightedShotId ?? selectedShot?.shotId}
                onSelect={handleGallerySelect}
              />
            </div>
          </div>
        </div>
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
        />
      </div>
      </div>
    </>
  );
};

export default PromptPlannerPage;
