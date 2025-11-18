"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
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
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  PromptPlannerCard,
  Scene,
  Shot,
} from "@/components/redesign/PromptPlannerCard";
import { ChatInput } from "@/components/redesign/ChatInput";
import { PageNavigation } from "@/components/redesign/PageNavigation";

// Demo data
const INITIAL_SCENES: Scene[] = [
  {
    id: "scene-1",
    title: "Opening - The City Awakens",
    description: "Wide establishing shot of the city at dawn, golden light streaming through skyscrapers",
    isExpanded: true,
    shots: [
      {
        id: "shot-1-1",
        text: "Aerial view panning slowly over the city skyline. The sun rises behind glass towers, casting long shadows across empty streets. A few early commuters visible as tiny dots below.",
        color: "green",
      },
      {
        id: "shot-1-2",
        text: "Street level - Camera tracks a rush of people emerging from subway stations. Coffee cups in hand, briefcases swinging. The city coming alive with energy and movement.",
        color: "red",
      },
      {
        id: "shot-1-3",
        text: "Close-up of a coffee shop window. Steam rising from fresh espresso. Barista's hands crafting latte art. Through the window, blurred figures of the morning crowd.",
        color: "blue",
      },
    ],
  },
  {
    id: "scene-2",
    title: "The Discovery",
    description: "Our protagonist finds a mysterious glowing object in a dark alley",
    isExpanded: true,
    shots: [
      {
        id: "shot-2-1",
        text: "Character walks cautiously into a dimly lit alley. Flickering neon signs overhead. Distant traffic sounds echo. Camera follows from behind, tension building.",
        color: "amber",
      },
      {
        id: "shot-2-2",
        text: "POV shot - Character's perspective as they notice a faint blue glow emanating from behind a dumpster. Hand reaches out tentatively. The glow intensifies.",
        color: "blue",
      },
      {
        id: "shot-2-3",
        text: "Extreme close-up of character's eyes widening in wonder and fear. The blue light reflects in their pupils. Slow push-in on their face as realization dawns.",
        color: "blue",
      },
    ],
  },
  {
    id: "scene-3",
    title: "The Chase",
    description: "Intense pursuit through city streets at night",
    isExpanded: false,
    shots: [
      {
        id: "shot-3-1",
        text: "Wide shot of character sprinting down rain-slicked streets. Neon reflections in puddles. Camera crane shot pulling back to reveal pursuers behind.",
        color: "red",
      },
      {
        id: "shot-3-2",
        text: "Handheld camera racing alongside character as they weave through crowd. Quick cuts. Heavy breathing. Looking back over shoulder in panic.",
        color: "red",
      },
    ],
  },
];

const PromptPlannerPage = () => {
  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [chatInputValue, setChatInputValue] = useState("");
  const [selectedShot, setSelectedShot] = useState<{
    shotId: string;
    sceneId: string;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Scene operations
  const handleToggleExpand = (sceneId: string) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId
          ? { ...scene, isExpanded: !scene.isExpanded }
          : scene
      )
    );
  };

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      title: "New Scene",
      description: "Describe your scene here...",
      isExpanded: true,
      shots: [],
    };
    setScenes((prev) => [...prev, newScene]);
  };

  const handleDeleteScene = (sceneId: string) => {
    setScenes((prev) => prev.filter((scene) => scene.id !== sceneId));
  };

  const handleUpdateSceneTitle = (sceneId: string, title: string) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId ? { ...scene, title } : scene
      )
    );
  };

  const handleUpdateSceneDescription = (sceneId: string, description: string) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId ? { ...scene, description } : scene
      )
    );
  };

  // Shot operations
  const handleAddShot = (sceneId: string) => {
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;

        const newShot: Shot = {
          id: `shot-${Date.now()}`,
          text: "Describe your shot here...",
        };

        return {
          ...scene,
          shots: [...scene.shots, newShot],
        };
      })
    );
  };

  const handleDeleteShot = (sceneId: string, shotId: string) => {
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;

        return {
          ...scene,
          shots: scene.shots.filter((shot) => shot.id !== shotId),
        };
      })
    );
  };

  const handleUpdateShotText = (sceneId: string, shotId: string, text: string) => {
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;

        return {
          ...scene,
          shots: scene.shots.map((shot) =>
            shot.id === shotId ? { ...shot, text } : shot
          ),
        };
      })
    );
  };

  const handleShotClick = (shot: Shot, sceneId: string) => {
    setChatInputValue(shot.text);
    setSelectedShot({ shotId: shot.id, sceneId });
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    // Check if dragging a scene
    if (active.id.toString().startsWith("scene-")) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setScenes(arrayMove(scenes, oldIndex, newIndex));
      }
    }
    // Check if dragging a shot
    else if (active.id.toString().startsWith("shot-")) {
      const activeSceneId = active.data.current?.sceneId;
      const overSceneId = over.data.current?.sceneId;

      if (!activeSceneId) {
        setActiveId(null);
        return;
      }

      const newScenes = [...scenes];
      const activeSceneIndex = newScenes.findIndex((s) => s.id === activeSceneId);

      if (activeSceneIndex === -1) {
        setActiveId(null);
        return;
      }

      const activeScene = newScenes[activeSceneIndex];
      const activeShotIndex = activeScene.shots.findIndex((shot) => shot.id === active.id);

      if (activeShotIndex === -1) {
        setActiveId(null);
        return;
      }

      // If dropping on another shot, reorder within scene
      if (overSceneId) {
        const overSceneIndex = newScenes.findIndex((s) => s.id === overSceneId);
        if (overSceneIndex !== -1) {
          const overScene = newScenes[overSceneIndex];
          const overShotIndex = overScene.shots.findIndex((shot) => shot.id === over.id);

          if (overShotIndex !== -1) {
            if (activeSceneId === overSceneId) {
              // Reorder within same scene
              const reorderedShots = arrayMove(
                activeScene.shots,
                activeShotIndex,
                overShotIndex
              );
              newScenes[activeSceneIndex] = {
                ...activeScene,
                shots: reorderedShots,
              };
            } else {
              // Move shot to different scene
              const [movedShot] = activeScene.shots.splice(activeShotIndex, 1);
              overScene.shots.splice(overShotIndex, 0, movedShot);

              newScenes[activeSceneIndex] = { ...activeScene };
              newScenes[overSceneIndex] = { ...overScene };
            }
          }
        }
      }

      setScenes(newScenes);
    }

    setActiveId(null);
  };

  // ChatInput handlers
  const handleChatSubmit = (message: string, settings: any) => {
    console.log("Chat submitted:", { message, settings });

    // If a shot is selected, update it with the enhanced message
    if (selectedShot) {
      handleUpdateShotText(selectedShot.sceneId, selectedShot.shotId, message);
      setSelectedShot(null);
    }

    // Clear input
    setChatInputValue("");
  };

  // Get all shot IDs for the sortable context
  const getAllShotIds = () => {
    return scenes.flatMap((scene) => scene.shots.map((shot) => shot.id));
  };

  return (
    <div className="h-screen w-full bg-[var(--bg-base)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 bg-[var(--bg-base)]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Prompt Planner</h1>
            <p className="text-sm text-gray-400 mt-1">
              Map out your scenes and shots with AI-enhanced prompts
            </p>
          </div>

          {/* Navigation */}
          <PageNavigation />

          <Button
            onClick={handleAddScene}
            className="bg-white text-black hover:bg-gray-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Scene
          </Button>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-auto pb-32">
          <div className="max-w-7xl mx-auto px-8 py-6 space-y-4">
            {scenes.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 mb-4">No scenes yet. Start planning your story!</p>
                <Button onClick={handleAddScene} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Scene
                </Button>
              </div>
            ) : (
              <SortableContext
                items={scenes.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {scenes.map((scene, index) => (
                  <SortableContext
                    key={scene.id}
                    items={scene.shots.map((shot) => shot.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <PromptPlannerCard
                      scene={scene}
                      sceneIndex={index}
                      onToggleExpand={handleToggleExpand}
                      onShotClick={handleShotClick}
                      onAddShot={handleAddShot}
                      onDeleteScene={handleDeleteScene}
                      onDeleteShot={handleDeleteShot}
                      onUpdateSceneTitle={handleUpdateSceneTitle}
                      onUpdateSceneDescription={handleUpdateSceneDescription}
                      onUpdateShotText={handleUpdateShotText}
                    />
                  </SortableContext>
                ))}
              </SortableContext>
            )}
          </div>
        </div>
      </DndContext>

      {/* ChatInput - Fixed Bottom */}
      <div className="flex-shrink-0">
        <ChatInput
          onSubmit={handleChatSubmit}
          initialMessage={chatInputValue}
          onMessageChange={setChatInputValue}
        />
      </div>
    </div>
  );
};

export default PromptPlannerPage;
