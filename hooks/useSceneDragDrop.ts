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

export interface Scene {
  id: string;
  title: string;
  description: string;
  isExpanded: boolean;
  shots: Shot[];
}

export interface Shot {
  id: string;
  text: string;
  color?: string;
}

interface UseSceneDragDropProps {
  scenes: Scene[];
  onScenesChange: (scenes: Scene[]) => void;
}

export const useSceneDragDrop = ({
  scenes,
  onScenesChange,
}: UseSceneDragDropProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"scene" | "shot" | null>(null);

  // Configure sensors for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Determine if dragging a scene or shot
    if (active.id.toString().startsWith("scene-")) {
      setActiveType("scene");
    } else if (active.id.toString().startsWith("shot-")) {
      setActiveType("shot");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    if (activeType === "scene") {
      // Reorder scenes
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newScenes = arrayMove(scenes, oldIndex, newIndex);
        onScenesChange(newScenes);
      }
    } else if (activeType === "shot") {
      // Handle shot reordering (within or across scenes)
      const activeSceneId = active.data.current?.sceneId;
      const overSceneId = over.data.current?.sceneId;

      if (!activeSceneId || !overSceneId) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      const activeSceneIndex = scenes.findIndex((s) => s.id === activeSceneId);
      const overSceneIndex = scenes.findIndex((s) => s.id === overSceneId);

      if (activeSceneIndex === -1 || overSceneIndex === -1) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      const newScenes = [...scenes];
      const activeScene = newScenes[activeSceneIndex];
      const overScene = newScenes[overSceneIndex];

      const activeShotIndex = activeScene.shots.findIndex(
        (shot) => shot.id === active.id,
      );
      const overShotIndex = overScene.shots.findIndex(
        (shot) => shot.id === over.id,
      );

      if (activeShotIndex === -1 || overShotIndex === -1) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      if (activeSceneId === overSceneId) {
        // Reorder within same scene
        const reorderedShots = arrayMove(
          activeScene.shots,
          activeShotIndex,
          overShotIndex,
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

      onScenesChange(newScenes);
    }

    setActiveId(null);
    setActiveType(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveType(null);
  };

  // Get the currently dragged item for overlay
  const getActiveItem = () => {
    if (!activeId) return null;

    if (activeType === "scene") {
      return scenes.find((s) => s.id === activeId);
    } else if (activeType === "shot") {
      for (const scene of scenes) {
        const shot = scene.shots.find((s) => s.id === activeId);
        if (shot) return shot;
      }
    }

    return null;
  };

  return {
    sensors,
    activeId,
    activeType,
    activeItem: getActiveItem(),
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    DndContext,
    DragOverlay,
    SortableContext,
    closestCenter,
    verticalListSortingStrategy,
  };
};
