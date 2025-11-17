"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Scene } from "@/types/scene";
import {
  VoiceSelectionDialog,
  type VoiceSelectionDialogSelection,
} from "@/components/VoiceSelectionDialog";
import { MINIMAX_VOICES } from "@/lib/voice-selection";
import { SceneCard } from "./storyboard/SceneCard";
import { TimelinePreview } from "./storyboard/TimelinePreview";
import { VoiceSettingsCard } from "./storyboard/VoiceSettingsCard";
import { useStoryboardState } from "./storyboard/useStoryboardState";
import { apiFetch } from "@/lib/api-fetch";

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
  const state = useStoryboardState(initialScenes, projectId);
  const {
    scenes,
    setScenes,
    draggedIndex,
    setDraggedIndex,
    regeneratingScenes,
    setRegeneratingScenes,
    audioGeneratingScenes,
    setAudioGeneratingScenes,
    showVoiceDialog,
    setShowVoiceDialog,
    updateScene,
    updateSceneOrder,
    deleteSceneMutation,
    updateVoiceSettings,
    totalDuration,
    sampleAudioUrl,
    currentVoiceLabel,
    currentVoiceReasoning,
    voiceSettings,
  } = state;

  const toggleAudioGenerating = (sceneId: string, isGenerating: boolean) => {
    setAudioGeneratingScenes((prev) => {
      const next = new Set(prev);
      if (isGenerating) {
        next.add(sceneId);
      } else {
        next.delete(sceneId);
      }
      return next;
    });
  };

  const regenerateNarration = async (
    scene: Scene,
    options?: {
      customText?: string;
      voiceId?: string;
      emotion?: string;
      speed?: number;
      pitch?: number;
    },
  ) => {
    if (!projectId || scene.id.startsWith("temp-")) {
      return;
    }

    toggleAudioGenerating(scene.id, true);

    try {
      const response = await apiFetch("/api/regenerate-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.id,
          newVoiceId: options?.voiceId,
          newEmotion: options?.emotion,
          newSpeed: options?.speed,
          newPitch: options?.pitch,
          customText: options?.customText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate audio");
      }

      const result = await response.json();

      setScenes((prev) =>
        prev.map((s) =>
          s.id === scene.id
            ? {
                ...s,
                narrationUrl: result.audioUrl,
                narrationText:
                  result.narrationText ??
                  options?.customText ??
                  s.narrationText,
                voiceId: result.voiceId ?? s.voiceId,
                voiceName: result.voiceName ?? s.voiceName,
              }
            : s,
        ),
      );
    } catch (error) {
      console.error("Failed to regenerate narration:", error);
    } finally {
      toggleAudioGenerating(scene.id, false);
    }
  };

  const handleDurationChange = async (id: string, duration: number) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === id ? { ...scene, duration } : scene)),
    );

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
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, description } : scene,
      ),
    );

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

  const handleDeleteScene = async (id: string) => {
    if (scenes.length > 1) {
      setScenes((prev) => prev.filter((scene) => scene.id !== id));

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

  const handleNarrationTextChange = (id: string, narrationText: string) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, narrationText } : scene,
      ),
    );
  };

  const handleRegenerateNarration = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    regenerateNarration(scene);
  };

  const handleRegenerateNarrationWithText = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene || !scene.narrationText) return;
    regenerateNarration(scene, { customText: scene.narrationText });
  };

  const handleVoiceDialogConfirm = async (
    selection: VoiceSelectionDialogSelection,
  ) => {
    if (!projectId) return;
    try {
      await updateVoiceSettings({
        projectId,
        selectedVoiceId: selection.voiceId,
        selectedVoiceName: MINIMAX_VOICES[selection.voiceId].name,
        voiceReasoning:
          selection.reasoning || "Manual voice selection from storyboard.",
        emotion: selection.emotion,
        speed: selection.speed,
        pitch: selection.pitch,
      });
      if (selection.regenerateAll) {
        for (const scene of scenes) {
          if (!scene.id.startsWith("temp-")) {
            await regenerateNarration(scene, {
              voiceId: selection.voiceId,
              emotion: selection.emotion,
              speed: selection.speed,
              pitch: selection.pitch,
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to update project voice settings:", error);
    } finally {
      setShowVoiceDialog(false);
    }
  };

  const handleRegenerateScene = async (id: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;

    setRegeneratingScenes((prev) => new Set(prev).add(id));

    try {
      const visualPrompt = `${scene.description}, cinematic lighting, high quality, professional photography, 8k, photorealistic`;

      const response = await apiFetch("/api/regenerate-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualPrompt: visualPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || "Failed to regenerate scene",
        );
      }

      const result = await response.json();

      setScenes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, image: result.imageUrl } : s)),
      );

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

    if (projectId && scenes.length > 0) {
      try {
        const sceneUpdates = scenes.map((scene, index) => ({
          sceneId: scene.id as Id<"scenes">,
          sceneNumber: index + 1,
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

      {/* Voice Settings */}
      <VoiceSettingsCard
        currentVoiceLabel={currentVoiceLabel}
        currentVoiceReasoning={currentVoiceReasoning}
        sampleAudioUrl={sampleAudioUrl}
        onShowVoiceDialog={() => setShowVoiceDialog(true)}
      />

      {/* Scenes */}
      <div className="space-y-4 mb-6">
        {scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={index}
            draggedIndex={draggedIndex}
            isRegenerating={regeneratingScenes.has(scene.id)}
            isAudioGenerating={audioGeneratingScenes.has(scene.id)}
            currentVoiceLabel={currentVoiceLabel}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onRegenerateScene={handleRegenerateScene}
            onDescriptionChange={handleDescriptionChange}
            onDurationChange={handleDurationChange}
            onDeleteScene={handleDeleteScene}
            onRegenerateNarration={handleRegenerateNarration}
            onRegenerateNarrationWithText={handleRegenerateNarrationWithText}
            onNarrationTextChange={handleNarrationTextChange}
            onShowVoiceDialog={() => setShowVoiceDialog(true)}
            canDelete={scenes.length > 1}
            projectId={projectId}
          />
        ))}
      </div>

      {/* Timeline Preview */}
      <TimelinePreview scenes={scenes} totalDuration={totalDuration} />

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

      <VoiceSelectionDialog
        open={showVoiceDialog}
        onClose={() => setShowVoiceDialog(false)}
        defaultVoiceId={
          (voiceSettings?.selectedVoiceId as keyof typeof MINIMAX_VOICES) ||
          (scenes[0]?.voiceId as keyof typeof MINIMAX_VOICES) ||
          "Wise_Woman"
        }
        defaultEmotion={voiceSettings?.emotion || undefined}
        defaultSpeed={voiceSettings?.speed || undefined}
        defaultPitch={voiceSettings?.pitch || undefined}
        onConfirm={handleVoiceDialogConfirm}
        disabled={!projectId}
      />
    </div>
  );
};
