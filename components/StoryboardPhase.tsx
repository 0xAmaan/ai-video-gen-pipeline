"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  GripVertical,
  Trash2,
  Sparkles,
  Plus,
  Loader2,
  RefreshCw,
  Volume2,
  Music2,
  Search,
} from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Scene } from "@/types/scene";
import {
  VoiceSelectionDialog,
  type VoiceSelectionDialogSelection,
} from "@/components/VoiceSelectionDialog";
import { MINIMAX_VOICES } from "@/lib/voice-selection";
import type { MiniMaxVoiceId } from "@/lib/voice-selection";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { VoiceWaveformPlayer } from "@/components/audio/VoiceWaveformPlayer";
import type { MusicGenerationOptions } from "@/types/audio";

type VoiceProvider = "replicate" | "elevenlabs";
type MusicGenerationModel = "lyria-2" | "musicgen" | "bark";

const MUSIC_MODEL_OPTIONS: Array<{
  value: MusicGenerationModel;
  label: string;
  description: string;
}> = [
  {
    value: "lyria-2",
    label: "Google Lyria 2",
    description: "48kHz stereo, supports negative prompts & seed control",
  },
  {
    value: "musicgen",
    label: "MusicGen Large",
    description: "Adjust clip length and loop-friendly backgrounds",
  },
  {
    value: "bark",
    label: "Bark Hybrid",
    description: "Speech + ambient cues with inline sound effect tags",
  },
];

type AudioSearchResult = {
  id: string;
  title: string;
  url: string;
  durationSeconds: number;
  tags: string[];
  previewUrl?: string;
  streamUrl?: string;
  downloadUrl?: string;
  attribution?: string;
};

const resolveFreesoundAudioSrc = (result: AudioSearchResult) => {
  const fallbackUrl =
    result.previewUrl || result.streamUrl || result.downloadUrl || result.url;
  console.log("[StoryboardPhase] Freesound audio preview source", {
    freesoundId: result.id,
    previewUrl: result.previewUrl,
    streamUrl: result.streamUrl,
    downloadUrl: result.downloadUrl,
    fallbackUrl,
  });
  return fallbackUrl;
};

interface StoryboardPhaseProps {
  prompt: string;
  scenes: Scene[];
  onGenerateVideo: (scenes: Scene[]) => void | Promise<void>;
  projectId: Id<"videoProjects"> | null;
  project: Doc<"videoProjects"> | null;
}

export const StoryboardPhase = ({
  prompt,
  scenes: initialScenes,
  onGenerateVideo,
  projectId,
  project,
}: StoryboardPhaseProps) => {
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<string>>(
    new Set(),
  );
  const [audioGeneratingScenes, setAudioGeneratingScenes] = useState<
    Set<string>
  >(new Set());
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState(
    project?.backgroundMusicPrompt || "",
  );
  const [musicModel, setMusicModel] =
    useState<MusicGenerationModel>("lyria-2");
  const [musicNegativePrompt, setMusicNegativePrompt] = useState("");
  const [musicSeed, setMusicSeed] = useState("");
  const [musicDurationSeconds, setMusicDurationSeconds] = useState(30);
  const [musicDurationLocked, setMusicDurationLocked] = useState(false);
  const [barkHistoryPrompt, setBarkHistoryPrompt] = useState("");
  const [barkTextTemp, setBarkTextTemp] = useState(0.7);
  const [barkWaveformTemp, setBarkWaveformTemp] = useState(0.7);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicGenerationError, setMusicGenerationError] = useState<
    string | null
  >(null);
  const [bgmPreviewUrl, setBgmPreviewUrl] = useState<string | null>(
    project?.backgroundMusicUrl ?? null,
  );
  const [bgmSource, setBgmSource] = useState<string | null>(
    project?.backgroundMusicSource ?? null,
  );
  const [bgmPrompt, setBgmPrompt] = useState<string>(
    project?.backgroundMusicPrompt ?? "",
  );
  const [freesoundQuery, setFreesoundQuery] = useState("uplifting cinematic");
  const [freesoundMood, setFreesoundMood] = useState("");
  const [freesoundCategory, setFreesoundCategory] = useState("");
  const [freesoundDuration, setFreesoundDuration] = useState<[number, number]>([
    0,
    120,
  ]);
  const [isSearchingFreesound, setIsSearchingFreesound] = useState(false);
  const [freesoundError, setFreesoundError] = useState<string | null>(null);
  const [freesoundResults, setFreesoundResults] = useState<AudioSearchResult[]>(
    [],
  );
  const [bgmAttribution, setBgmAttribution] = useState<string | null>(null);
  const [sfxDialogOpen, setSfxDialogOpen] = useState(false);
  const [sfxDialogSceneId, setSfxDialogSceneId] = useState<string | null>(null);
  const [sfxDialogUrl, setSfxDialogUrl] = useState("");
  const [sfxDialogDuration, setSfxDialogDuration] = useState<number>(3);
  const [sfxDialogOffset, setSfxDialogOffset] = useState<number>(0);
  const [sfxDialogMood, setSfxDialogMood] = useState("");
  const [sfxDialogAttribution, setSfxDialogAttribution] = useState("");
  const [sfxDialogSource, setSfxDialogSource] =
    useState<"freesound" | "generated" | "uploaded">("freesound");
  const [sfxDialogLoading, setSfxDialogLoading] = useState(false);
  const [sfxDialogError, setSfxDialogError] = useState<string | null>(null);
  const [sfxDialogTags, setSfxDialogTags] = useState<string[]>([]);
  const [sfxDialogFreesoundId, setSfxDialogFreesoundId] = useState<string | null>(
    null,
  );
  const [deletingAudioAssetIds, setDeletingAudioAssetIds] = useState<
    Set<string>
  >(new Set());

  // Convex mutations
  const updateScene = useMutation(api.video.updateScene);
  const updateSceneOrder = useMutation(api.video.updateSceneOrder);
  const deleteSceneMutation = useMutation(api.video.deleteScene);
  const updateVoiceSettings = useMutation(api.video.updateProjectVoiceSettings);
  const updateProjectBackgroundMusic = useMutation(
    api.video.updateProjectBackgroundMusic,
  );
  const createAudioAsset = useMutation(api.video.createAudioAsset);
  const updateAudioAsset = useMutation(api.video.updateAudioAsset);
  const deleteAudioAssetMutation = useMutation(api.video.deleteAudioAsset);

  // Load scenes from Convex
  const convexScenes = useQuery(
    api.video.getScenes,
    projectId ? { projectId } : "skip",
  );
  const voiceSettings = useQuery(
    api.video.getProjectVoiceSettings,
    projectId ? { projectId } : "skip",
  );
  const audioAssets = useQuery(
    api.video.getAudioAssets,
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

  const projectAudioAssets = audioAssets ?? [];
  const projectBgmAsset = useMemo(
    () =>
      projectAudioAssets.find(
        (asset) => asset.type === "bgm" && !asset.sceneId,
      ) ?? null,
    [projectAudioAssets],
  );
  const sceneAudioAssets = useMemo(() => {
    const map = new Map<string, Doc<"audioAssets">[]>();
    projectAudioAssets.forEach((asset) => {
      if (asset.sceneId) {
        const key = asset.sceneId as string;
        const bucket = map.get(key) ?? [];
        bucket.push(asset);
        map.set(key, bucket);
      }
    });
    return map;
  }, [projectAudioAssets]);
  const sceneStartTimes = useMemo(() => {
    let cursor = 0;
    const map = new Map<string, number>();
    scenes
      .slice()
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
      .forEach((scene) => {
        map.set(scene.id, cursor);
        cursor += scene.duration;
    });
    return map;
  }, [scenes]);

  useEffect(() => {
    const nextUrl = projectBgmAsset?.url ?? project?.backgroundMusicUrl ?? null;
    const nextSource =
      projectBgmAsset?.source ?? project?.backgroundMusicSource ?? null;
    const nextPrompt =
      projectBgmAsset?.prompt ?? project?.backgroundMusicPrompt ?? "";
    const attribution =
      projectBgmAsset &&
      typeof projectBgmAsset.metadata === "object" &&
      projectBgmAsset.metadata !== null
        ? (projectBgmAsset.metadata as { attribution?: string }).attribution ??
          null
        : null;
    setBgmPreviewUrl(nextUrl);
    setBgmSource(nextSource);
    setBgmPrompt(nextPrompt);
    setBgmAttribution(attribution);
    if (
      projectBgmAsset &&
      projectBgmAsset.metadata &&
      typeof projectBgmAsset.metadata === "object"
    ) {
      const metadata = projectBgmAsset.metadata as Record<string, unknown>;
      if (
        metadata.model === "lyria-2" ||
        metadata.model === "musicgen" ||
        metadata.model === "bark"
      ) {
        setMusicModel(metadata.model);
      }
      if (typeof metadata.negative_prompt === "string") {
        setMusicNegativePrompt(metadata.negative_prompt);
      }
      if (
        typeof metadata.seed === "number" ||
        typeof metadata.seed === "string"
      ) {
        setMusicSeed(String(metadata.seed));
      }
      if (
        typeof metadata.history_prompt === "string" ||
        metadata.history_prompt === null
      ) {
        setBarkHistoryPrompt(metadata.history_prompt ?? "");
      }
      if (typeof metadata.text_temp === "number") {
        setBarkTextTemp(metadata.text_temp);
      }
      if (typeof metadata.waveform_temp === "number") {
        setBarkWaveformTemp(metadata.waveform_temp);
      }
    } else {
      setMusicNegativePrompt("");
      setMusicSeed("");
      setBarkHistoryPrompt("");
      setBarkTextTemp(0.7);
      setBarkWaveformTemp(0.7);
    }
  }, [
    project?.backgroundMusicUrl,
    project?.backgroundMusicSource,
    project?.backgroundMusicPrompt,
    projectBgmAsset,
  ]);

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const recommendedMusicDuration = Math.min(
    Math.max(totalDuration || 30, 15),
    90,
  );
  useEffect(() => {
    if (!musicDurationLocked) {
      setMusicDurationSeconds(recommendedMusicDuration);
    }
  }, [recommendedMusicDuration, musicDurationLocked]);

  useEffect(() => {
    if (musicModel !== "musicgen") {
      setMusicDurationLocked(false);
    }
  }, [musicModel]);
  const sampleAudioUrl = useMemo(
    () => scenes.find((scene) => scene.narrationUrl)?.narrationUrl,
    [scenes],
  );
  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };
  const currentVoiceLabel =
    voiceSettings?.selectedVoiceName ||
    scenes[0]?.voiceName ||
    MINIMAX_VOICES["Wise_Woman"].name;
  const currentVoiceProvider =
    (voiceSettings?.voiceProvider as VoiceProvider) ?? "replicate";
  const barkVoiceSelected =
    voiceSettings?.voiceModelKey === "bark-voice" ||
    scenes.some((scene) => scene.voiceId?.startsWith("bark"));
  const currentVoiceProviderLabel =
    currentVoiceProvider === "elevenlabs"
      ? "ElevenLabs"
      : barkVoiceSelected
        ? "Replicate (Bark)"
        : "Replicate (MiniMax)";
  const currentVoiceReasoning =
    voiceSettings?.voiceReasoning ||
    (currentVoiceProvider === "elevenlabs"
      ? "Premium ElevenLabs narration."
      : "AI selected this voice for your prompt.");
  const musicPromptPlaceholder =
    musicModel === "bark"
      ? "Hybrid narration prompt. Include tags like [music], [laughter], [sighs] for Bark."
      : "Describe the mood, instruments, or tempo you want...";

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

  const handleApplyBackgroundMusic = async ({
    url,
    source,
    mood,
    promptSummary,
    durationSeconds,
    attribution,
    provider,
    modelKey,
    freesoundId,
    tags,
    metadata,
  }: {
    url: string;
    source: "generated" | "freesound" | "uploaded";
    mood?: string;
    promptSummary?: string;
    durationSeconds?: number;
    attribution?: string;
    provider?: string;
    modelKey?: string;
    freesoundId?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }) => {
    if (!projectId || !url) return;
    try {
      await updateProjectBackgroundMusic({
        projectId,
        backgroundMusicUrl: url,
        backgroundMusicSource: source,
        backgroundMusicPrompt: promptSummary,
        backgroundMusicMood: mood,
      });
      const safeDuration =
        typeof durationSeconds === "number" && durationSeconds > 0
          ? durationSeconds
          : totalDuration > 0
            ? totalDuration
            : 30;
      const metadataPayload: Record<string, unknown> = {
        role: "project-bgm",
        ...(attribution ? { attribution } : {}),
        ...(freesoundId ? { freesoundId } : {}),
        ...(Array.isArray(tags) && tags.length > 0 ? { tags } : {}),
        ...(metadata ?? {}),
      };
      if (projectBgmAsset) {
        await updateAudioAsset({
          assetId: projectBgmAsset._id,
          url,
          source,
          duration: safeDuration,
          prompt: promptSummary,
          mood,
          provider,
          modelKey,
          timelineStart: 0,
          timelineEnd: safeDuration,
          metadata: {
            ...(projectBgmAsset.metadata ?? {}),
            ...metadataPayload,
          },
        });
      } else {
        await createAudioAsset({
          projectId,
          type: "bgm",
          source,
          url,
          duration: safeDuration,
          prompt: promptSummary,
          mood,
          provider,
          modelKey,
          timelineStart: 0,
          timelineEnd: safeDuration,
          metadata: metadataPayload,
        });
      }
      console.log("[StoryboardPhase] Background music applied", {
        url,
        source,
        provider,
        modelKey,
        attribution,
        freesoundId,
      });
      setBgmPreviewUrl(url);
      setBgmSource(source);
      setBgmPrompt(promptSummary ?? "");
      setBgmAttribution(attribution ?? null);
    } catch (error) {
      console.error("Failed to save background music:", error);
    }
  };

  const handleGenerateBackgroundMusic = async () => {
    if (!projectId) return;
    const trimmedPrompt =
      musicPrompt.trim() || "cinematic uplifting background music";
    const durationHint = Math.min(Math.max(totalDuration, 15), 90);
    const durationForMusicGen = Math.max(
      10,
      Math.round(
        musicDurationSeconds > 0 ? musicDurationSeconds : durationHint,
      ),
    );
    let negativePromptArg: string | undefined;
    let seedArg: number | undefined;
    let historyPromptArg: string | null | undefined;
    let textTempArg: number | undefined;
    let waveformTempArg: number | undefined;
    const payload: MusicGenerationOptions = {
      prompt: trimmedPrompt,
      model: musicModel,
    };
    if (musicModel === "musicgen") {
      payload.duration = durationForMusicGen;
    } else if (musicModel === "lyria-2") {
      const negative = musicNegativePrompt.trim();
      if (negative.length > 0) {
        payload.negative_prompt = negative;
        negativePromptArg = negative;
      }
      const seedValue = Number(musicSeed);
      if (
        musicSeed.trim().length > 0 &&
        Number.isFinite(seedValue)
      ) {
        payload.seed = seedValue;
        seedArg = seedValue;
      }
    } else if (musicModel === "bark") {
      const history = barkHistoryPrompt.trim();
      historyPromptArg = history.length > 0 ? history : null;
      payload.history_prompt = historyPromptArg;
      textTempArg = Number.isFinite(barkTextTemp) ? barkTextTemp : 0.7;
      payload.text_temp = textTempArg;
      waveformTempArg = Number.isFinite(barkWaveformTemp)
        ? barkWaveformTemp
        : 0.7;
      payload.waveform_temp = waveformTempArg;
    }
    const metadata: Record<string, unknown> = {
      model: musicModel,
    };
    if (negativePromptArg) {
      metadata.negative_prompt = negativePromptArg;
    }
    if (typeof seedArg === "number") {
      metadata.seed = seedArg;
    }
    if (historyPromptArg !== undefined) {
      metadata.history_prompt = historyPromptArg;
    }
    if (typeof textTempArg === "number") {
      metadata.text_temp = textTempArg;
    }
    if (typeof waveformTempArg === "number") {
      metadata.waveform_temp = waveformTempArg;
    }
    setIsGeneratingMusic(true);
    setMusicGenerationError(null);
    try {
      const response = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.track?.audioUrl) {
        throw new Error(
          data.error || "Failed to generate music. Please try again.",
        );
      }
      const trackDuration =
        typeof data.track.durationSeconds === "number"
          ? data.track.durationSeconds
          : Number(data.track.durationSeconds) || durationHint;
      await handleApplyBackgroundMusic({
        url: data.track.audioUrl,
        source: "generated",
        promptSummary: trimmedPrompt,
        durationSeconds: trackDuration,
        provider: "replicate",
        modelKey: typeof data.modelKey === "string" ? data.modelKey : undefined,
        metadata,
      });
    } catch (error) {
      setMusicGenerationError(
        error instanceof Error ? error.message : "Unable to generate music.",
      );
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const handleFreesoundSearch = async () => {
    if (!projectId) return;
    if (!freesoundQuery.trim()) {
      setFreesoundError("Enter a few keywords to search for music.");
      return;
    }
    setIsSearchingFreesound(true);
    setFreesoundError(null);
    const payload = {
      query: freesoundQuery.trim(),
      mood: freesoundMood.trim() || undefined,
      category: freesoundCategory.trim() || undefined,
      durationRange: freesoundDuration,
    };
    console.log("[StoryboardPhase] Submitting Freesound search", payload);
    try {
      const response = await fetch("/api/search-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Freesound search failed");
      }
      console.log("[StoryboardPhase] Freesound search response", {
        count: Array.isArray(data.results) ? data.results.length : 0,
        sampleIds: Array.isArray(data.results)
          ? data.results.slice(0, 5).map((item: AudioSearchResult) => item.id)
          : [],
      });
      setFreesoundResults(data.results ?? []);
    } catch (error) {
      console.error("[StoryboardPhase] Freesound search failed", {
        error,
        payload,
      });
      setFreesoundError(
        error instanceof Error ? error.message : "Search failed.",
      );
    } finally {
      setIsSearchingFreesound(false);
    }
  };

  const handleSelectFreesoundTrack = async (result: AudioSearchResult) => {
    const resolvedUrl =
      result.streamUrl || result.downloadUrl || result.url || null;
    if (!resolvedUrl) {
      console.error("[StoryboardPhase] Unable to apply Freesound track", {
        freesoundId: result.id,
        result,
      });
      setFreesoundError("Unable to load the selected track.");
      return;
    }
    console.log("[StoryboardPhase] Applying Freesound track", {
      freesoundId: result.id,
      resolvedUrl,
      attribution: result.attribution,
    });
    await handleApplyBackgroundMusic({
      url: resolvedUrl,
      source: "freesound",
      mood: freesoundMood || result.tags[0],
      promptSummary:
        result.tags.slice(0, 4).join(", ") ||
        `Freesound track ${result.title ?? result.id}`,
      durationSeconds:
        typeof result.durationSeconds === "number"
          ? result.durationSeconds
          : undefined,
      attribution: result.attribution,
      provider: "freesound",
      modelKey: "freesound-music-library",
      freesoundId: result.id,
      tags: result.tags,
    });
  };

  const handleClearBackgroundMusic = async () => {
    if (!projectId) return;
    try {
      await updateProjectBackgroundMusic({
        projectId,
        backgroundMusicUrl: undefined,
        backgroundMusicSource: undefined,
        backgroundMusicPrompt: undefined,
        backgroundMusicMood: undefined,
      });
      if (projectBgmAsset) {
        await deleteAudioAssetMutation({
          assetId: projectBgmAsset._id as Id<"audioAssets">,
        });
      }
      setBgmPreviewUrl(null);
      setBgmSource(null);
      setBgmPrompt("");
      setBgmAttribution(null);
    } catch (error) {
      console.error("Failed to clear background music:", error);
    }
  };

  const resetSfxDialogState = () => {
    setSfxDialogSceneId(null);
    setSfxDialogUrl("");
    setSfxDialogDuration(3);
    setSfxDialogOffset(0);
    setSfxDialogMood("");
    setSfxDialogAttribution("");
    setSfxDialogSource("freesound");
    setSfxDialogError(null);
    setSfxDialogTags([]);
    setSfxDialogFreesoundId(null);
  };

  const openSfxDialogForScene = (sceneId: string) => {
    if (sceneId.startsWith("temp-")) {
      return;
    }
    setSfxDialogSceneId(sceneId);
    setSfxDialogUrl("");
    setSfxDialogDuration(3);
    setSfxDialogOffset(0);
    setSfxDialogMood("");
    setSfxDialogAttribution("");
    setSfxDialogSource("uploaded");
    setSfxDialogError(null);
    setSfxDialogTags([]);
    setSfxDialogFreesoundId(null);
    setSfxDialogOpen(true);
  };

  const openSfxDialogFromResult = (result: AudioSearchResult) => {
    setSfxDialogSceneId(null);
    setSfxDialogUrl(result.url);
    setSfxDialogDuration(
      typeof result.durationSeconds === "number" && result.durationSeconds > 0
        ? result.durationSeconds
        : 3,
    );
    setSfxDialogOffset(0);
    setSfxDialogMood(result.tags[0] || "");
    setSfxDialogAttribution(result.attribution || "");
    setSfxDialogSource("freesound");
    setSfxDialogError(null);
    setSfxDialogTags(result.tags);
    setSfxDialogFreesoundId(result.id);
    setSfxDialogOpen(true);
  };

  const handleConfirmSfxAttachment = async () => {
    if (!projectId) {
      setSfxDialogError("Save your project before attaching audio.");
      return;
    }
    const availableSceneId =
      sfxDialogSceneId ||
      scenes.find((scene) => !scene.id.startsWith("temp-"))?.id ||
      null;
    if (!availableSceneId || availableSceneId.startsWith("temp-")) {
      setSfxDialogError("Select a scene for this sound effect.");
      return;
    }
    if (!sfxDialogUrl.trim()) {
      setSfxDialogError("Audio URL is required.");
      return;
    }
    setSfxDialogLoading(true);
    setSfxDialogError(null);
    try {
      const sceneStart = sceneStartTimes.get(availableSceneId) ?? 0;
      const offset =
        typeof sfxDialogOffset === "number" ? Number(sfxDialogOffset) : 0;
      const duration =
        typeof sfxDialogDuration === "number" && sfxDialogDuration > 0
          ? sfxDialogDuration
          : 1;
      const timelineStart = Math.max(0, sceneStart + offset);
      await createAudioAsset({
        projectId,
        sceneId: availableSceneId as Id<"scenes">,
        type: "sfx",
        source: sfxDialogSource,
        url: sfxDialogUrl.trim(),
        duration,
        mood: sfxDialogMood || undefined,
        timelineStart,
        timelineEnd: timelineStart + duration,
        provider: sfxDialogSource === "freesound" ? "freesound" : undefined,
        metadata: {
          role: "scene-sfx",
          ...(sfxDialogAttribution ? { attribution: sfxDialogAttribution } : {}),
          ...(sfxDialogTags.length ? { tags: sfxDialogTags } : {}),
          ...(sfxDialogFreesoundId ? { freesoundId: sfxDialogFreesoundId } : {}),
        },
      });
      setSfxDialogOpen(false);
      resetSfxDialogState();
    } catch (error) {
      console.error("Failed to attach sound effect:", error);
      setSfxDialogError(
        error instanceof Error
          ? error.message
          : "Unable to attach sound effect.",
      );
    } finally {
      setSfxDialogLoading(false);
    }
  };

  const handleRemoveAudioAsset = async (assetId: string) => {
    setDeletingAudioAssetIds((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
    try {
      await deleteAudioAssetMutation({
        assetId: assetId as Id<"audioAssets">,
      });
    } catch (error) {
      console.error("Failed to delete audio asset:", error);
    } finally {
      setDeletingAudioAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  const updateFreesoundDurationRange = (index: 0 | 1, value: number) => {
    setFreesoundDuration((prev) => {
      const next: [number, number] = [...prev] as [number, number];
      next[index] = Math.max(0, value);
      return next;
    });
  };

  const handleDeleteScene = async (id: string) => {
    if (scenes.length <= 1) {
      return;
    }

    const isTempScene = id.startsWith("temp-");

    // Update local state immediately
    setScenes((prev) => prev.filter((scene) => scene.id !== id));

    if (isTempScene || !projectId) {
      return;
    }

    try {
      await deleteSceneMutation({
        sceneId: id as Id<"scenes">,
      });
    } catch (error) {
      console.error("Failed to delete scene:", error);
    }
  };

  const handleNarrationTextChange = (id: string, narrationText: string) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === id ? { ...scene, narrationText } : scene,
      ),
    );
  };

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
      voiceProvider?: VoiceProvider;
      voiceModelKey?: string;
    },
  ) => {
    if (!projectId || scene.id.startsWith("temp-")) {
      console.warn("Cannot regenerate narration until scenes are saved.");
      return;
    }

    toggleAudioGenerating(scene.id, true);

    try {
      const response = await fetch("/api/regenerate-narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.id,
          newVoiceId: options?.voiceId,
          newEmotion: options?.emotion,
          newSpeed: options?.speed,
          newPitch: options?.pitch,
          customText: options?.customText,
          voiceProvider: options?.voiceProvider,
          voiceModelKey: options?.voiceModelKey,
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
                  result.narrationText ?? options?.customText ?? s.narrationText,
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

  const handleRegenerateNarration = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    regenerateNarration(scene, {
      voiceId:
        scene.voiceId ||
        voiceSettings?.selectedVoiceId ||
        "Wise_Woman",
      emotion: voiceSettings?.emotion,
      speed: voiceSettings?.speed,
      pitch: voiceSettings?.pitch,
      voiceProvider:
        (voiceSettings?.voiceProvider as VoiceProvider) ?? "replicate",
      voiceModelKey: voiceSettings?.voiceModelKey ?? undefined,
    });
  };

  const handleRegenerateNarrationWithText = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene || !scene.narrationText) return;
    regenerateNarration(scene, {
      customText: scene.narrationText,
      voiceId:
        scene.voiceId ||
        voiceSettings?.selectedVoiceId ||
        "Wise_Woman",
      emotion: voiceSettings?.emotion,
      speed: voiceSettings?.speed,
      pitch: voiceSettings?.pitch,
      voiceProvider:
        (voiceSettings?.voiceProvider as VoiceProvider) ?? "replicate",
      voiceModelKey: voiceSettings?.voiceModelKey ?? undefined,
    });
  };

  const handleVoiceDialogConfirm = async (
    selection: VoiceSelectionDialogSelection,
  ) => {
    if (!projectId) return;
    const provider =
      selection.voiceProvider ??
      (voiceSettings?.voiceProvider as VoiceProvider) ??
      "replicate";
    const resolvedVoiceName =
      selection.voiceName ||
      (provider === "elevenlabs"
        ? "ElevenLabs Voice"
        : MINIMAX_VOICES[
            (selection.voiceId as MiniMaxVoiceId) || "Wise_Woman"
          ]?.name ||
          "Wise Woman");
    try {
      await updateVoiceSettings({
        projectId,
        selectedVoiceId: selection.voiceId,
        selectedVoiceName: resolvedVoiceName,
        voiceReasoning:
          selection.reasoning || "Manual voice selection from storyboard.",
        emotion: selection.emotion,
        speed: selection.speed,
        pitch: selection.pitch,
        voiceProvider: provider,
        voiceModelKey: selection.voiceModelKey,
        providerVoiceId:
          provider === "elevenlabs" ? selection.voiceId : undefined,
      });
      if (selection.regenerateAll) {
        for (const scene of scenes) {
          if (!scene.id.startsWith("temp-")) {
            await regenerateNarration(scene, {
              voiceId: selection.voiceId,
              emotion: selection.emotion,
              speed: selection.speed,
              pitch: selection.pitch,
              voiceProvider: provider,
              voiceModelKey: selection.voiceModelKey,
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
        throw new Error(
          errorData.details || errorData.error || "Failed to regenerate scene",
        );
      }

      const result = await response.json();

      // Update local state
      setScenes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, image: result.imageUrl } : s)),
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

    {/* Voice Settings */}
      {sampleAudioUrl ? (
        <div className="mb-6">
          <VoiceWaveformPlayer
            audioUrl={sampleAudioUrl}
            voiceName={currentVoiceLabel}
            provider={currentVoiceProviderLabel}
            narrationText={currentVoiceReasoning}
            onChangeVoice={() => setShowVoiceDialog(true)}
          />
        </div>
      ) : (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> Narration Voice
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentVoiceLabel} • {currentVoiceProviderLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentVoiceReasoning}
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowVoiceDialog(true)}>
              Change Voice
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Generate narration to preview the selected voice.
          </p>
        </Card>
      )}

      {/* Background Music */}
      <Card className="p-4 mb-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-medium flex items-center gap-2">
              <Music2 className="w-4 h-4" /> Background Music
            </h3>
            <p className="text-sm text-muted-foreground">
              {bgmPreviewUrl
                ? `Source: ${bgmSource ?? "unknown"}${
                    bgmPrompt ? ` • ${bgmPrompt}` : ""
                  }`
                : "Generate or search for a soundtrack to accompany your scenes."}
            </p>
            {bgmAttribution && (
              <p className="text-xs text-muted-foreground">
                Attribution: {bgmAttribution}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 w-full sm:w-auto">
            {bgmPreviewUrl ? (
              <>
                <AudioPlayer
                  className="w-full sm:w-64"
                  src={bgmPreviewUrl}
                  label="ProjectBGM"
                  debugContext={{
                    source: bgmSource,
                    attribution: bgmAttribution ?? undefined,
                    projectId,
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearBackgroundMusic}
                >
                  Remove
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No background music selected
              </p>
            )}
          </div>
        </div>
        <Separator />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </h4>
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Select
                value={musicModel}
                onValueChange={(value) =>
                  setMusicModel(value as MusicGenerationModel)
                }
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUSIC_MODEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              placeholder={musicPromptPlaceholder}
            />
            {musicModel === "lyria-2" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Negative prompt
                  </label>
                  <Input
                    value={musicNegativePrompt}
                    onChange={(e) => setMusicNegativePrompt(e.target.value)}
                    placeholder="e.g., vocals, busy drums"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Seed (optional)
                  </label>
                  <Input
                    type="number"
                    value={musicSeed}
                    onChange={(e) => setMusicSeed(e.target.value)}
                    placeholder="Randomized if blank"
                  />
                </div>
              </div>
            )}
            {musicModel === "musicgen" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Duration</span>
                  <span className="text-muted-foreground">
                    {musicDurationSeconds}s (recommended: {recommendedMusicDuration}s)
                  </span>
                </div>
                <Slider
                  value={[musicDurationSeconds]}
                  min={10}
                  max={90}
                  step={5}
                  onValueChange={(value) => {
                    setMusicDurationLocked(true);
                    setMusicDurationSeconds(value[0]);
                  }}
                />
              </div>
            )}
            {musicModel === "bark" && (
              <div className="grid gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Voice preset (history prompt)
                  </label>
                  <Input
                    value={barkHistoryPrompt}
                    onChange={(e) => setBarkHistoryPrompt(e.target.value)}
                    placeholder="Leave blank for default Bark voice"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Text temperature
                    </label>
                    <Input
                      type="number"
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      value={barkTextTemp}
                      onChange={(e) =>
                        setBarkTextTemp(Number(e.target.value) || 0.7)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Waveform temperature
                    </label>
                    <Input
                      type="number"
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      value={barkWaveformTemp}
                      onChange={(e) =>
                        setBarkWaveformTemp(Number(e.target.value) || 0.7)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            {musicGenerationError && (
              <p className="text-xs text-destructive">{musicGenerationError}</p>
            )}
            <Button
              onClick={handleGenerateBackgroundMusic}
              disabled={isGeneratingMusic}
              className="w-full sm:w-auto"
            >
              {isGeneratingMusic ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Background Music
                </>
              )}
            </Button>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Search className="w-4 h-4" />
              Freesound Music Library
            </h4>
            <Input
              value={freesoundQuery}
              onChange={(e) => setFreesoundQuery(e.target.value)}
              placeholder="Search keywords (e.g., ambient, cinematic, playful)"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={freesoundMood}
                onChange={(e) => setFreesoundMood(e.target.value)}
                placeholder="Mood (optional)"
              />
              <Input
                value={freesoundCategory}
                onChange={(e) => setFreesoundCategory(e.target.value)}
                placeholder="Category (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                value={freesoundDuration[0]}
                onChange={(e) =>
                  updateFreesoundDurationRange(0, Number(e.target.value) || 0)
                }
                placeholder="Min seconds"
              />
              <Input
                type="number"
                min={0}
                value={freesoundDuration[1]}
                onChange={(e) =>
                  updateFreesoundDurationRange(1, Number(e.target.value) || 0)
                }
                placeholder="Max seconds"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleFreesoundSearch}
              disabled={isSearchingFreesound}
              className="w-full sm:w-auto"
            >
              {isSearchingFreesound ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search Freesound
                </>
              )}
            </Button>
            {freesoundError && (
              <p className="text-xs text-destructive">{freesoundError}</p>
            )}
            <ScrollArea className="h-48 border rounded-md">
              {isSearchingFreesound ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Searching Freesound...
                </div>
              ) : freesoundResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No results yet. Try a search above.
                </div>
              ) : (
                freesoundResults.map((result) => (
                  <div
                    key={result.id}
                    className="border-b last:border-b-0 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>{result.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(result.durationSeconds)}
                      </span>
                    </div>
                    {result.attribution && (
                      <p className="text-xs text-muted-foreground">
                        By {result.attribution}
                      </p>
                    )}
                    <AudioPlayer
                      className="w-full"
                      src={resolveFreesoundAudioSrc(result)}
                      label="FreesoundPreview"
                      debugContext={{
                        freesoundId: result.id,
                        attribution: result.attribution,
                      }}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{result.tags.slice(0, 3).join(", ")}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSelectFreesoundTrack(result)}
                        >
                          Use Track
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSfxDialogFromResult(result)}
                          disabled={!projectId}
                        >
                          Add SFX
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        </div>
      </Card>

      {/* Scenes */}
      <div className="space-y-4 mb-6">
        {scenes.map((scene, index) => {
          const sceneAssets = sceneAudioAssets.get(scene.id) ?? [];
          const sceneSfxAssets = sceneAssets.filter(
            (asset) => asset.type === "sfx",
          );
          return (
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
                    title={
                      regeneratingScenes.has(scene.id)
                        ? "Regenerating..."
                        : "Regenerate scene"
                    }
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
                    Scene Prompt{" "}
                    <span className="text-muted-foreground font-normal">
                      (for video generation)
                    </span>
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

                {/* Narration Controls */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <Badge
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => setShowVoiceDialog(true)}
                    >
                      Voice: {scene.voiceName || currentVoiceLabel}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRegenerateNarration(scene.id)}
                        disabled={
                          audioGeneratingScenes.has(scene.id) ||
                          scene.id.startsWith("temp-") ||
                          !projectId
                        }
                      >
                        {audioGeneratingScenes.has(scene.id) ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Regenerate Audio
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRegenerateNarrationWithText(scene.id)
                        }
                        disabled={
                          audioGeneratingScenes.has(scene.id) ||
                          !scene.narrationText ||
                          scene.id.startsWith("temp-") ||
                          !projectId
                        }
                      >
                        {audioGeneratingScenes.has(scene.id) ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        Regenerate with new text
                      </Button>
                    </div>
                  </div>
                  {scene.narrationUrl ? (
                    <div>
                      <AudioPlayer
                        className="w-full"
                        src={scene.narrationUrl}
                        label="SceneNarration"
                        debugContext={{
                          sceneId: scene.id,
                          sceneNumber: index + 1,
                        }}
                      />
                      {scene.narrationText && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          “{scene.narrationText}”
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Narration not generated yet.
                    </p>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Narration Text
                    </label>
                    <Textarea
                      value={scene.narrationText || ""}
                      onChange={(e) =>
                        handleNarrationTextChange(scene.id, e.target.value)
                      }
                      className="min-h-[80px] resize-y text-sm"
                      placeholder="What should the narrator say for this scene?"
                    />
                  </div>
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
              {/* Sound Effects */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Sound Effects</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSfxDialogForScene(scene.id)}
                    disabled={
                      !projectId ||
                      scene.id.startsWith("temp-") ||
                      isGeneratingMusic
                    }
                  >
                    Add SFX
                  </Button>
                </div>
                {sceneSfxAssets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No sound effects attached to this scene.
                  </p>
                ) : (
                  sceneSfxAssets.map((asset) => {
                    const sceneStart = sceneStartTimes.get(scene.id) ?? 0;
                    const relativeStart = Math.max(
                      0,
                      (asset.timelineStart ?? sceneStart) - sceneStart,
                    );
                    const assetDuration =
                      typeof asset.duration === "number"
                        ? asset.duration
                        : 0;
                    const metadata =
                      typeof asset.metadata === "object" && asset.metadata
                        ? (asset.metadata as { attribution?: string })
                        : {};
                    const isDeleting = deletingAudioAssetIds.has(asset._id);
                    return (
                      <div
                        key={asset._id}
                        className="rounded-md border p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {asset.mood || "Sound effect"}
                            </span>
                            <span className="text-muted-foreground">
                              Starts at {formatDuration(relativeStart)} •{" "}
                              {formatDuration(assetDuration)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isDeleting ? (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveAudioAsset(asset._id)}
                                title="Remove sound effect"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {metadata.attribution && (
                          <p className="text-muted-foreground">
                            {metadata.attribution}
                          </p>
                        )}
                        <AudioPlayer
                          className="w-full"
                          src={asset.url}
                          label="SceneSFX"
                          debugContext={{
                            assetId: asset._id,
                            sceneId: scene.id,
                            role: asset.metadata?.role,
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          );
        })}
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
                    <span className="text-xs text-muted-foreground">
                      No image
                    </span>
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

      <VoiceSelectionDialog
        open={showVoiceDialog}
        onClose={() => setShowVoiceDialog(false)}
        defaultVoiceId={
          voiceSettings?.selectedVoiceId ||
          scenes[0]?.voiceId ||
          "Wise_Woman"
        }
        defaultVoiceName={voiceSettings?.selectedVoiceName}
        defaultVoiceProvider={currentVoiceProvider}
        defaultVoiceModelKey={voiceSettings?.voiceModelKey ?? undefined}
        defaultEmotion={voiceSettings?.emotion || undefined}
        defaultSpeed={voiceSettings?.speed || undefined}
        defaultPitch={voiceSettings?.pitch || undefined}
        onConfirm={handleVoiceDialogConfirm}
        disabled={!projectId}
      />
      <Dialog
        open={sfxDialogOpen}
        onOpenChange={(open) => {
          setSfxDialogOpen(open);
          if (!open) {
            resetSfxDialogState();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Sound Effect</DialogTitle>
            <DialogDescription>
              Select a scene and provide the audio clip you want to drop onto
              the timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Scene
              </label>
              <Select
                value={sfxDialogSceneId ?? ""}
                onValueChange={(value) =>
                  setSfxDialogSceneId(value.length ? value : null)
                }
                disabled={!projectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose scene" />
                </SelectTrigger>
                <SelectContent>
                  {scenes
                    .filter((scene) => !scene.id.startsWith("temp-"))
                    .map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        Scene {scene.sceneNumber}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Audio URL
              </label>
              <Input
                placeholder="https://..."
                value={sfxDialogUrl}
                onChange={(e) => setSfxDialogUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Duration (seconds)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={sfxDialogDuration}
                  onChange={(e) =>
                    setSfxDialogDuration(Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Start offset (seconds)
                </label>
                <Input
                  type="number"
                  value={sfxDialogOffset}
                  onChange={(e) =>
                    setSfxDialogOffset(Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Label/Mood
              </label>
              <Input
                value={sfxDialogMood}
                onChange={(e) => setSfxDialogMood(e.target.value)}
                placeholder="e.g., Whoosh, Door slam"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Attribution
              </label>
              <Input
                value={sfxDialogAttribution}
                onChange={(e) => setSfxDialogAttribution(e.target.value)}
                placeholder="Credit (optional)"
              />
            </div>
          </div>
          {sfxDialogError && (
            <p className="text-xs text-destructive">{sfxDialogError}</p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSfxDialogOpen(false);
                resetSfxDialogState();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSfxAttachment}
              disabled={sfxDialogLoading}
            >
              {sfxDialogLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Attaching...
                </>
              ) : (
                "Attach Sound"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
