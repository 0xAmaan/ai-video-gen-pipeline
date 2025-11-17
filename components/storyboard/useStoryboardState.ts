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

  // Music state
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(
    null,
  );
  const [backgroundMusicPrompt, setBackgroundMusicPrompt] =
    useState<string>("");
  const [audioTrackSettings, setAudioTrackSettings] = useState({
    narration: { volume: 1.0, muted: false },
    bgm: { volume: 0.6, muted: false },
    sfx: { volume: 0.8, muted: false },
  });

  // Convex mutations
  const updateScene = useMutation(api.video.updateScene);
  const updateSceneOrder = useMutation(api.video.updateSceneOrder);
  const deleteSceneMutation = useMutation(api.video.deleteScene);
  const updateVoiceSettings = useMutation(api.video.updateProjectVoiceSettings);
  const updateProjectBackgroundMusic = useMutation(
    api.video.updateProjectBackgroundMusic,
  );
  const updateProjectAudioTrackSettings = useMutation(
    api.video.updateProjectAudioTrackSettings,
  );

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

  // Music handlers
  const handleMusicGenerated = async (
    url: string,
    prompt: string,
    source: "generated" | "freesound",
  ) => {
    if (!projectId) return;

    setBackgroundMusicUrl(url);
    setBackgroundMusicPrompt(prompt);

    await updateProjectBackgroundMusic({
      projectId,
      backgroundMusicUrl: url,
      backgroundMusicSource: source,
      backgroundMusicPrompt: prompt,
    });
  };

  const handleAudioTrackUpdate = async (
    track: "narration" | "bgm" | "sfx",
    settings: Partial<{ volume: number; muted: boolean }>,
  ) => {
    if (!projectId) return;

    const trackIdMap = {
      narration: "audio-narration" as const,
      bgm: "audio-bgm" as const,
      sfx: "audio-sfx" as const,
    };

    setAudioTrackSettings((prev) => ({
      ...prev,
      [track]: { ...prev[track], ...settings },
    }));

    await updateProjectAudioTrackSettings({
      projectId,
      trackId: trackIdMap[track],
      volume: settings.volume,
      muted: settings.muted,
    });
  };

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
    // Music state and handlers
    backgroundMusicUrl,
    backgroundMusicPrompt,
    audioTrackSettings,
    handleMusicGenerated,
    handleAudioTrackUpdate,
  };
}
