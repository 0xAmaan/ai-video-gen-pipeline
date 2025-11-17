import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Scene } from "@/types/scene";
import { MINIMAX_VOICES } from "@/lib/voice-selection";

export function useStoryboardState(
  initialScenes: Scene[],
  projectId: Id<"videoProjects"> | null,
) {
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<string>>(
    new Set(),
  );
  const [audioGeneratingScenes, setAudioGeneratingScenes] = useState<
    Set<string>
  >(new Set());
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);

  // Convex mutations
  const updateScene = useMutation(api.video.updateScene);
  const updateSceneOrder = useMutation(api.video.updateSceneOrder);
  const deleteSceneMutation = useMutation(api.video.deleteScene);
  const updateVoiceSettings = useMutation(api.video.updateProjectVoiceSettings);

  // Load scenes from Convex
  const convexScenes = useQuery(
    api.video.getScenes,
    projectId ? { projectId } : "skip",
  );
  const voiceSettings = useQuery(
    api.video.getProjectVoiceSettings,
    projectId ? { projectId } : "skip",
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
        narrationUrl: scene.narrationUrl || undefined,
        narrationText: scene.narrationText || "",
        voiceId: scene.voiceId || undefined,
        voiceName: scene.voiceName || undefined,
      }));
      setScenes(formattedScenes);
    }
  }, [convexScenes]);

  const totalDuration = useMemo(
    () => scenes.reduce((sum, scene) => sum + scene.duration, 0),
    [scenes],
  );

  const sampleAudioUrl = useMemo(
    () => scenes.find((scene) => scene.narrationUrl)?.narrationUrl,
    [scenes],
  );

  const currentVoiceLabel =
    voiceSettings?.selectedVoiceName ||
    scenes[0]?.voiceName ||
    MINIMAX_VOICES["Wise_Woman"].name;

  const currentVoiceReasoning =
    voiceSettings?.voiceReasoning || "AI selected this voice for your prompt.";

  return {
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
  };
}
