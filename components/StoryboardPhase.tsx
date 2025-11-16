"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, GripVertical, Trash2, Sparkles, Plus, Loader2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Scene } from "@/types/scene";

interface StoryboardPhaseProps {
  prompt: string;
  scenes: Scene[];
  onGenerateVideo: (scenes: Scene[]) => void;
  projectId: Id<"videoProjects"> | null;
}

export const StoryboardPhase = ({
  prompt,
  scenes: initialScenes,
  onGenerateVideo,
  projectId,
}: StoryboardPhaseProps) => {
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<string>>(new Set());

  // Convex mutations
  const updateScene = useMutation(api.video.updateScene);
  const updateSceneOrder = useMutation(api.video.updateSceneOrder);
  const deleteSceneMutation = useMutation(api.video.deleteScene);

  // Load scenes from Convex
  const convexScenes = useQuery(
    api.video.getScenes,
    projectId ? { projectId } : "skip"
  );

  // Sync Convex scenes to local state
  useEffect(() => {
    if (convexScenes && convexScenes.length > 0) {
      const formattedScenes: Scene[] = convexScenes.map((scene) => ({
        id: scene._id,
        image: scene.imageUrl || "",
        description: scene.description,
        visualPrompt: scene.visualPrompt,
        duration: scene.duration,
        sceneNumber: scene.sceneNumber,
      }));
      setScenes(formattedScenes);
    }
  }, [convexScenes]);

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

  const handleDurationChange = async (id: string, duration: number) => {
    // Update local state immediately
    setScenes((prev) =>
      prev.map((scene) => (scene.id === id ? { ...scene, duration } : scene)),
    );

    // Save to Convex
    if (projectId) {
      try {
        await updateScene({
          sceneId: id as Id<"scenes">,
          duration,
        });
      } catch (error) {
        console.error("Failed to update scene duration:", error);
      }
    }
  };

  const handleDescriptionChange = async (id: string, description: string) => {
    // Update local state immediately
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, description } : scene,
      ),
    );

    // Save to Convex (debounced in practice, but we'll do it immediately for now)
    if (projectId) {
      try {
        await updateScene({
          sceneId: id as Id<"scenes">,
          description,
        });
      } catch (error) {
        console.error("Failed to update scene description:", error);
      }
    }
  };

  const handleVisualPromptChange = async (id: string, visualPrompt: string) => {
    // Update local state immediately
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, visualPrompt } : scene,
      ),
    );

    // Save to Convex
    if (projectId) {
      try {
        await updateScene({
          sceneId: id as Id<"scenes">,
          visualPrompt,
        });
      } catch (error) {
        console.error("Failed to update scene visual prompt:", error);
      }
    }
  };

  const handleDeleteScene = async (id: string) => {
    if (scenes.length > 1) {
      // Update local state immediately
      setScenes((prev) => prev.filter((scene) => scene.id !== id));

      // Delete from Convex
      if (projectId) {
        try {
          await deleteSceneMutation({
            sceneId: id as Id<"scenes">,
          });
        } catch (error) {
          console.error("Failed to delete scene:", error);
        }
      }
    }
  };

  // Removed handleAddScene - scenes must be generated via API, not manually added
  // Manual scenes weren't persisted to Convex and caused data loss on refresh

  const handleRegenerateScene = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;

    // Mark scene as regenerating
    setRegeneratingScenes((prev) => new Set(prev).add(id));

    try {
      // Create enhanced visual prompt from description
      const visualPrompt = `${scene.description}, cinematic lighting, high quality, professional photography, 8k, photorealistic`;

      const response = await fetch("/api/regenerate-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualPrompt: visualPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Regenerate API error:", errorData);
        throw new Error(errorData.details || errorData.error || "Failed to regenerate scene");
      }

      const result = await response.json();

      // Update local state
      setScenes((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, image: result.imageUrl } : s
        )
      );

      // Save to Convex
      if (projectId) {
        try {
          await updateScene({
            sceneId: id as Id<"scenes">,
            imageUrl: result.imageUrl,
          });
        } catch (error) {
          console.error("Failed to save regenerated image to Convex:", error);
        }
      }
    } catch (error) {
      console.error("Error regenerating scene:", error);
    } finally {
      // Remove from regenerating set
      setRegeneratingScenes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newScenes = [...scenes];
    const draggedScene = newScenes[draggedIndex];
    newScenes.splice(draggedIndex, 1);
    newScenes.splice(index, 0, draggedScene);

    setScenes(newScenes.map((scene, idx) => ({ ...scene, order: idx })));
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);

    // Save the new order to Convex
    if (projectId && scenes.length > 0) {
      try {
        const sceneUpdates = scenes.map((scene, index) => ({
          sceneId: scene.id as Id<"scenes">,
          sceneNumber: index + 1, // Convert to 1-indexed
        }));

        await updateSceneOrder({
          projectId,
          sceneUpdates,
        });
      } catch (error) {
        console.error("Failed to update scene order:", error);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-3">Review Your Storyboard</h1>
        <p className="text-muted-foreground mb-4">
          Edit scenes, adjust timing, and reorder to perfect your video
        </p>

        {/* Original Prompt */}
        <Card className="p-4 bg-accent/30">
          <p className="text-sm text-muted-foreground mb-1">Original prompt:</p>
          <p className="text-sm">{prompt}</p>
        </Card>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        <Badge variant="secondary" className="text-base px-4 py-2">
          {scenes.length} {scenes.length === 1 ? "Scene" : "Scenes"}
        </Badge>
        <Badge variant="secondary" className="text-base px-4 py-2">
          {totalDuration}s Total Duration
        </Badge>
      </div>

      {/* Scenes */}
      <div className="space-y-4 mb-6">
        {scenes.map((scene, index) => (
          <Card
            key={scene.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`p-6 transition-all cursor-grab active:cursor-grabbing ${
              draggedIndex === index ? "opacity-50" : ""
            }`}
          >
            <div className="flex gap-4">
              {/* Drag Handle */}
              <div className="flex items-center text-muted-foreground cursor-grab active:cursor-grabbing">
                <GripVertical className="w-5 h-5" />
              </div>

              {/* Scene Number & Image */}
              <div className="shrink-0">
                <Badge className="mb-2">Scene {index + 1}</Badge>
                <div className="relative w-48 h-27 rounded-lg overflow-hidden bg-accent">
                  {scene.image ? (
                    <img
                      src={scene.image}
                      alt={`Scene ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <span className="text-sm">No image</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleRegenerateScene(scene.id)}
                    disabled={regeneratingScenes.has(scene.id)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    title={regeneratingScenes.has(scene.id) ? "Regenerating..." : "Regenerate scene"}
                  >
                    {regeneratingScenes.has(scene.id) ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* Scene Content */}
              <div className="flex-1 space-y-4">
                {/* Description (contains the detailed visual prompt for video generation) */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Scene Prompt <span className="text-muted-foreground font-normal">(for video generation)</span>
                  </label>
                  <Textarea
                    value={scene.description}
                    onChange={(e) =>
                      handleDescriptionChange(scene.id, e.target.value)
                    }
                    className="min-h-[120px] resize-y text-sm"
                    placeholder="Detailed visual description for AI video generation..."
                  />
                </div>

                {/* Duration & Delete */}
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">
                      Duration: {scene.duration}s
                    </label>
                    <Slider
                      value={[scene.duration]}
                      onValueChange={([value]) =>
                        handleDurationChange(scene.id, value)
                      }
                      min={5}
                      max={10}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      WAN 2.5 supports 5s or 10s clips
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeleteScene(scene.id)}
                    disabled={scenes.length === 1}
                    title="Delete scene"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Scene button removed - scenes must be generated via API */}

      {/* Timeline Preview */}
      <Card className="p-6 mb-8">
        <h3 className="text-sm font-semibold mb-4">Timeline Preview</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {scenes.map((scene, index) => {
            const widthPercent = (scene.duration / totalDuration) * 100;
            return (
              <div
                key={scene.id}
                style={{ width: `${Math.max(widthPercent, 10)}%` }}
                className="relative shrink-0 h-16 rounded overflow-hidden border-2 border-border hover:border-primary transition-colors cursor-pointer"
                title={`Scene ${index + 1} - ${scene.duration}s`}
              >
                {scene.image ? (
                  <img
                    src={scene.image}
                    alt={`Scene ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-accent flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-1">
                  <span className="text-white text-xs font-medium">
                    {scene.duration}s
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Generate Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => onGenerateVideo(scenes)}
          size="lg"
          className="bg-primary hover:bg-primary/90 px-8"
          disabled={scenes.some((s) => !s.image)}
        >
          Generate Video
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
        {scenes.some((s) => !s.image) && (
          <p className="text-sm text-muted-foreground mt-2 ml-4">
            All scenes must have images before generating video
          </p>
        )}
      </div>
    </div>
  );
};
