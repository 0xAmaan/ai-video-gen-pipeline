"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, GripVertical, Trash2, Sparkles, Plus } from "lucide-react";

interface Scene {
  id: string;
  image: string;
  description: string;
  duration: number;
  order: number;
}

interface StoryboardPhaseProps {
  prompt: string;
  scenes: Scene[];
  onGenerateVideo: (scenes: Scene[]) => void;
}

export const StoryboardPhase = ({
  prompt,
  scenes: initialScenes,
  onGenerateVideo,
}: StoryboardPhaseProps) => {
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

  const handleDurationChange = (id: string, duration: number) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === id ? { ...scene, duration } : scene)),
    );
  };

  const handleDescriptionChange = (id: string, description: string) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, description } : scene,
      ),
    );
  };

  const handleDeleteScene = (id: string) => {
    if (scenes.length > 1) {
      setScenes((prev) => prev.filter((scene) => scene.id !== id));
    }
  };

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      image: `https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=450&fit=crop`,
      description: "New scene - describe what should happen here...",
      duration: 5,
      order: scenes.length,
    };
    setScenes((prev) => [...prev, newScene]);
  };

  const handleRegenerateScene = (id: string) => {
    // Simulate regenerating the scene image
    const randomImages = [
      "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&h=450&fit=crop",
      "https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=800&h=450&fit=crop",
    ];
    const randomImage =
      randomImages[Math.floor(Math.random() * randomImages.length)];

    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, image: randomImage } : scene,
      ),
    );
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

  const handleDragEnd = () => {
    setDraggedIndex(null);
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
                  <img
                    src={scene.image}
                    alt={`Scene ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRegenerateScene(scene.id)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md transition-colors cursor-pointer"
                    title="Regenerate scene"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Scene Content */}
              <div className="flex-1 space-y-4">
                {/* Description */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Scene Description
                  </label>
                  <Textarea
                    value={scene.description}
                    onChange={(e) =>
                      handleDescriptionChange(scene.id, e.target.value)
                    }
                    className="min-h-[80px] resize-none"
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
                      min={1}
                      max={10}
                      step={0.5}
                      className="w-full"
                    />
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

      {/* Add Scene Button */}
      <Button
        variant="outline"
        onClick={handleAddScene}
        className="w-full mb-8"
        size="lg"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Scene
      </Button>

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
                <img
                  src={scene.image}
                  alt={`Scene ${index + 1}`}
                  className="w-full h-full object-cover"
                />
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
        >
          Generate Video
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
