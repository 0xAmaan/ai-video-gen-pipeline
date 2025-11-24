"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStoryboardRows } from "@/lib/hooks/useProjectRedesign";
import { generateMusicPromptFromVisuals } from "@/lib/music-prompt-generator";
import { generateVoiceoverScript } from "@/lib/voiceover-script-generator";
import {
  MINIMAX_EMOTIONS,
  MINIMAX_VOICES,
  type MiniMaxEmotion,
  type MiniMaxVoiceId,
} from "@/lib/voice-selection";
import { toast } from "sonner";
import { Loader2, Mic2, Music, RefreshCw, Wand2 } from "lucide-react";

const formatSeconds = (value?: number | null) => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "-";
  }
  const rounded = Math.max(0, Math.round(value));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

type SceneDuration = {
  sceneNumber: number;
  duration: number;
  sceneTitle?: string | null;
  sceneDescription?: string | null;
  shotCount: number;
};

const statusLabel: Record<string, string> = {
  generating: "Generating",
  complete: "Ready",
  failed: "Failed",
  pending: "Pending",
};

const TARGET_OFFSET_SECS = 2;

const AudioPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const projectData = useQuery(
    api.video.getProjectWithAllData,
    projectId && isAuthenticated ? { projectId } : "skip",
  );
  const voiceSettings = useQuery(
    api.video.getProjectVoiceSettings,
    projectId && isAuthenticated ? { projectId } : "skip",
  );
  const storyboardRows = useStoryboardRows(projectId);

  const audioAssets = projectData?.audioAssets ?? [];
  const scenes = projectData?.scenes ?? [];
  const clips = projectData?.clips ?? [];
  const completedClips = clips.filter((clip) => clip.status === "complete");
  const clipsForTiming =
    completedClips.length > 0 ? completedClips : clips;

  const sceneById = useMemo(() => {
    return new Map(scenes.map((scene) => [scene._id, scene]));
  }, [scenes]);

  const durationsByScene = useMemo(() => {
    const map = new Map<number, { duration: number; sceneTitle?: string | null }>();
    clipsForTiming.forEach((clip) => {
      if (!clip.duration || !Number.isFinite(clip.duration)) return;
      const scene = sceneById.get(clip.sceneId);
      const sceneNumber = scene?.sceneNumber;
      if (typeof sceneNumber !== "number") return;
      const current = map.get(sceneNumber) ?? {
        duration: 0,
        sceneTitle: scene?.description,
      };
      map.set(sceneNumber, {
        duration: current.duration + clip.duration,
        sceneTitle: scene?.description,
      });
    });
    return map;
  }, [clipsForTiming, sceneById]);

  const totalDuration = useMemo(
    () =>
      Array.from(durationsByScene.values()).reduce(
        (sum, entry) => sum + entry.duration,
        0,
      ),
    [durationsByScene],
  );

  const sceneBreakdown: SceneDuration[] = useMemo(() => {
    const storyboardByNumber = new Map(
      (storyboardRows ?? []).map((row) => [row.scene.sceneNumber, row]),
    );
    return Array.from(durationsByScene.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([sceneNumber, meta]) => {
        const storyboardScene = storyboardByNumber.get(sceneNumber);
        return {
          sceneNumber,
          duration: meta.duration,
          sceneTitle: storyboardScene?.scene.title ?? null,
          sceneDescription: storyboardScene?.scene.description ?? meta.sceneTitle,
          shotCount: storyboardScene?.shots.length ?? 0,
        };
      });
  }, [durationsByScene, storyboardRows]);

  const promptScenes = useMemo(
    () =>
      (storyboardRows ?? []).map((row) => ({
        title: row.scene.title,
        description: row.scene.description,
        sceneNumber: row.scene.sceneNumber,
        shots: row.shots.map((shot) => ({
          description: shot.shot.description,
          shotNumber: shot.shot.shotNumber,
          selectedImagePrompt: shot.selectedImage?.iterationPrompt,
        })),
      })),
    [storyboardRows],
  );

  const generatedPrompt = useMemo(() => {
    const durationTarget = Math.max(1, Math.round(totalDuration || 0));
    if (!durationTarget || promptScenes.length === 0) return null;
    return generateMusicPromptFromVisuals({
      durationSeconds: durationTarget,
      projectPrompt: projectData?.project?.prompt,
      scenes: promptScenes,
    });
  }, [promptScenes, projectData?.project?.prompt, totalDuration]);
  const voiceoverSuggestion = useMemo(
    () =>
      generateVoiceoverScript({
        projectPrompt: projectData?.project?.prompt,
        projectTitle:
          projectData?.project?.title ?? projectData?.project?.name,
        durationSeconds: totalDuration || undefined,
        scenes: sceneBreakdown.map((scene) => ({
          sceneNumber: scene.sceneNumber,
          title: scene.sceneTitle,
          description: scene.sceneDescription,
          durationSeconds: scene.duration,
        })),
      }),
    [
      projectData?.project?.name,
      projectData?.project?.prompt,
      projectData?.project?.title,
      sceneBreakdown,
      totalDuration,
    ],
  );

  const [promptValue, setPromptValue] = useState("");
  const [negativePromptValue, setNegativePromptValue] = useState(
    "dialogue, speech, vocals, narration",
  );
  const [seedValue, setSeedValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"soundtrack" | "voiceover">(
    "soundtrack",
  );
  const [voiceoverScript, setVoiceoverScript] = useState("");
  const [voiceoverVoiceId, setVoiceoverVoiceId] =
    useState<MiniMaxVoiceId>("Wise_Woman");
  const [voiceoverEmotion, setVoiceoverEmotion] =
    useState<MiniMaxEmotion>("auto");
  const [voiceoverSpeed, setVoiceoverSpeed] = useState(1);
  const [voiceoverPitch, setVoiceoverPitch] = useState(0);
  const [isVoiceoverGenerating, setIsVoiceoverGenerating] = useState(false);
  const [voiceoverError, setVoiceoverError] = useState<string | null>(null);
  const [voiceoverDuration, setVoiceoverDuration] = useState<number | null>(
    null,
  );
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [isScriptGenerating, setIsScriptGenerating] = useState(false);
  const voiceDefaultsApplied = useRef(false);

  useEffect(() => {
    if (generatedPrompt && !promptValue.trim()) {
      setPromptValue(generatedPrompt.prompt);
    }
    if (
      generatedPrompt &&
      (!negativePromptValue.trim() ||
        negativePromptValue === "dialogue, speech, vocals, narration")
    ) {
      setNegativePromptValue(generatedPrompt.negativePrompt);
    }
  }, [generatedPrompt, promptValue, negativePromptValue]);
  useEffect(() => {
    if (
      voiceoverSuggestion?.script &&
      !voiceoverScript.trim()
    ) {
      setVoiceoverScript(voiceoverSuggestion.script);
    }
  }, [voiceoverScript, voiceoverSuggestion]);

  const soundtrackAsset =
    audioAssets.find(
      (asset) =>
        asset.type === "bgm" &&
        (asset.provider === "lyria-2" || asset.modelKey === "lyria-2"),
    ) ?? null;
  const soundtrackUrl =
    soundtrackAsset?.url ?? projectData?.project?.soundtrackUrl ?? null;
  const soundtrackDuration =
    soundtrackAsset?.duration ??
    projectData?.project?.soundtrackDuration ??
    null;
  const soundtrackStatus =
    projectData?.project?.soundtrackStatus ??
    (soundtrackUrl ? "complete" : undefined);
  const voiceoverAsset = useMemo(() => {
    const assets = audioAssets
      .filter((asset) => asset.type === "voiceover")
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return assets[0] ?? null;
  }, [audioAssets]);

  const playbackDuration = lastDuration ?? soundtrackDuration ?? null;
  const targetDurationSeconds = Math.round(totalDuration || 0);
  const durationDelta =
    playbackDuration && targetDurationSeconds
      ? Math.abs(playbackDuration - targetDurationSeconds)
      : 0;
  const withinTolerance =
    playbackDuration === null ||
    targetDurationSeconds === 0 ||
    durationDelta <= TARGET_OFFSET_SECS;
  const voiceoverPlaybackDuration = voiceoverDuration ?? null;
  const voiceoverDurationDelta =
    voiceoverPlaybackDuration && targetDurationSeconds
      ? Math.abs(voiceoverPlaybackDuration - targetDurationSeconds)
      : null;
  const voiceoverWithinTolerance =
    voiceoverDurationDelta === null ||
    targetDurationSeconds === 0 ||
    (voiceoverDurationDelta ?? 0) <= TARGET_OFFSET_SECS + 4;

  useEffect(() => {
    if (soundtrackUrl) {
      setLastUrl(soundtrackUrl);
    }
    if (soundtrackDuration && Number.isFinite(soundtrackDuration)) {
      setLastDuration(soundtrackDuration);
    }
  }, [soundtrackDuration, soundtrackUrl]);

  useEffect(() => {
    if (voiceoverAsset?.url) {
      setVoiceoverUrl(voiceoverAsset.url);
    }
    if (
      typeof voiceoverAsset?.duration === "number" &&
      Number.isFinite(voiceoverAsset.duration)
    ) {
      setVoiceoverDuration(voiceoverAsset.duration);
    }
    if (
      voiceoverAsset?.prompt &&
      voiceoverAsset.prompt.length > 0 &&
      !voiceoverScript.trim()
    ) {
      setVoiceoverScript(voiceoverAsset.prompt);
    }
  }, [voiceoverAsset, voiceoverScript]);

  useEffect(() => {
    if (voiceDefaultsApplied.current || !voiceSettings) return;

    const candidateVoiceId =
      typeof voiceSettings.selectedVoiceId === "string" &&
      voiceSettings.selectedVoiceId in MINIMAX_VOICES
        ? (voiceSettings.selectedVoiceId as MiniMaxVoiceId)
        : ("Wise_Woman" as MiniMaxVoiceId);
    setVoiceoverVoiceId(candidateVoiceId);

    if (
      typeof voiceSettings.emotion === "string" &&
      (MINIMAX_EMOTIONS as readonly string[]).includes(voiceSettings.emotion)
    ) {
      setVoiceoverEmotion(voiceSettings.emotion as MiniMaxEmotion);
    }
    if (typeof voiceSettings.speed === "number") {
      setVoiceoverSpeed(voiceSettings.speed);
    }
    if (typeof voiceSettings.pitch === "number") {
      setVoiceoverPitch(voiceSettings.pitch);
    }

    voiceDefaultsApplied.current = true;
  }, [voiceSettings]);

  const hasMasterShots = useMemo(() => {
    if (!storyboardRows) return null;
    return storyboardRows.some((row) =>
      row.shots.some((shot) => shot.selectedImage),
    );
  }, [storyboardRows]);

  const canGenerate =
    Boolean(projectId) &&
    !isGenerating &&
    totalDuration > 0 &&
    hasMasterShots;
  const canGenerateVoiceover =
    Boolean(projectId) &&
    !isVoiceoverGenerating &&
    totalDuration > 0 &&
    hasMasterShots &&
    voiceoverScript.trim().length > 0;

  const statusProgress =
    soundtrackStatus === "generating"
      ? 55
      : soundtrackStatus === "complete"
        ? 100
        : soundtrackStatus === "failed"
          ? 0
          : 25;

  const handleGenerate = async (): Promise<boolean> => {
    if (!projectId) return false;
    if (!totalDuration || totalDuration <= 0) {
      setGenerationError("Generate videos in /storyboard before creating music.");
      return false;
    }
    if (!hasMasterShots) {
      setGenerationError(
        "Select master shots in /storyboard so the music matches the visuals.",
      );
      return false;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const parsedSeed = Number.parseInt(seedValue, 10);
      const body: Record<string, unknown> = {
        projectId,
        prompt: promptValue.trim(),
        negative_prompt: negativePromptValue.trim(),
      };
      if (!Number.isNaN(parsedSeed)) {
        body.seed = parsedSeed;
      }

      const response = await fetch("/api/generate-soundtrack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            result?.message ||
            "Soundtrack generation failed. Please try again.",
        );
      }

      if (result?.soundtrackUrl) {
        setLastUrl(result.soundtrackUrl as string);
      }
      if (result?.durationSeconds) {
        setLastDuration(result.durationSeconds as number);
      }

      toast.success("Soundtrack ready for Video Editor", {
        description: "BGM saved to the Video Editor timeline.",
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Soundtrack generation failed.";
      setGenerationError(message);
      toast.error("Unable to generate soundtrack", { description: message });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVoiceover = async (): Promise<boolean> => {
    if (!projectId) return false;
    if (!voiceoverScript.trim()) {
      setVoiceoverError("Add a quick ad-style script first.");
      return false;
    }
    if (!hasMasterShots) {
      setVoiceoverError(
        "Select master shots in /storyboard so the voiceover matches the visuals.",
      );
      return false;
    }

    setIsVoiceoverGenerating(true);
    setVoiceoverError(null);

    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          script: voiceoverScript.trim(),
          voiceId: voiceoverVoiceId,
          emotion: voiceoverEmotion,
          speed: voiceoverSpeed,
          pitch: voiceoverPitch,
          audio_format: "mp3",
          sample_rate: 44100,
          bitrate: 128000,
          channel: "mono",
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            result?.message ||
            "Voiceover generation failed. Please try again.",
        );
      }

      if (result?.voiceoverUrl) {
        setVoiceoverUrl(result.voiceoverUrl as string);
      }
      if (result?.durationSeconds) {
        setVoiceoverDuration(result.durationSeconds as number);
      }
      if (
        result?.script &&
        typeof result.script === "string" &&
        !voiceoverScript.trim()
      ) {
        setVoiceoverScript(result.script);
      }

      toast.success("Voiceover ready for Video Editor", {
        description: "Narration saved to the narration track.",
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Voiceover generation failed.";
      setVoiceoverError(message);
      toast.error("Unable to generate voiceover", { description: message });
      return false;
    } finally {
      setIsVoiceoverGenerating(false);
    }
  };

  const handleGenerateBoth = async () => {
    const soundtrackOk = await handleGenerate();
    if (!soundtrackOk) return;
    await handleGenerateVoiceover();
  };

  const handleGenerateScript = async () => {
    if (!projectId) return;
    setIsScriptGenerating(true);
    setVoiceoverError(null);
    try {
      const response = await fetch("/api/generate-voiceover-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result?.script) {
        throw new Error(
          result?.error ||
            result?.message ||
            "Could not generate a script. Try again.",
        );
      }
      setVoiceoverScript(result.script as string);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate script.";
      setVoiceoverError(message);
      toast.error("Script generation failed", { description: message });
    } finally {
      setIsScriptGenerating(false);
    }
  };

  const isLoadingData =
    authLoading ||
    (projectId && isAuthenticated && projectData === undefined);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-10 bg-black/90 border-b border-gray-900 px-8 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Soundtrack & Voiceover</h1>
            <p className="hidden text-sm text-gray-400 md:block">
              Generate the music bed and an ad-style read - they&apos;ll land on separate tracks in the editor.
            </p>
          </div>
          <PageNavigation
            projectId={projectId}
            audioLocked={!totalDuration}
            audioLockMessage="Generate videos in /storyboard first"
            editorLocked={!totalDuration}
            editorLockMessage="Generate videos in /storyboard first"
          />
        </div>
      </div>

      <div className="px-8 py-8 space-y-6">
        {isLoadingData ? (
          <div className="rounded-3xl border border-dashed border-gray-800 py-24 text-center text-gray-500">
            Loading project...
          </div>
        ) : !projectId ? (
          <div className="rounded-3xl border border-dashed border-gray-800 py-24 text-center text-gray-500">
            Missing project context.
          </div>
        ) : (
          <>
            <div className="grid gap-6">
              <Card className="border-gray-800 bg-gradient-to-br from-slate-900/80 via-black to-slate-950">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Music className="h-5 w-5 text-emerald-400" />
                      Duration alignment
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Keep both audio layers close to the storyboard runtime.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Progress value={statusProgress} className="h-2 bg-gray-900" />
                    <span className="text-xs text-gray-400">
                      {isGenerating
                        ? "Generating"
                        : statusLabel[soundtrackStatus ?? "pending"]}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                      <p className="text-sm text-gray-400">Total runtime</p>
                      <p className="mt-1 text-3xl font-semibold">
                        {formatSeconds(totalDuration)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                      <p className="text-sm text-gray-400">
                        Soundtrack in Video Editor
                      </p>
                      <p className="mt-1 text-lg font-medium">
                        {soundtrackUrl
                          ? "Ready on the music track"
                          : "Waiting for generation"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                      <p className="text-sm text-gray-400">
                        Voiceover in Video Editor
                      </p>
                      <p className="mt-1 text-lg font-medium">
                        {voiceoverUrl || voiceoverAsset
                          ? "Ready on narration track"
                          : "Optional - add the read"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-400">Scene breakdown</p>
                      <Badge variant="outline" className="text-gray-300">
                        {sceneBreakdown.length} scenes
                      </Badge>
                    </div>
                    {sceneBreakdown.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-800 p-4 text-sm text-gray-500">
                        Waiting for video clips... generate videos in /storyboard to size the soundtrack.
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {sceneBreakdown.map((scene) => (
                          <div
                            key={scene.sceneNumber}
                            className="rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2"
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-300">
                                Scene {scene.sceneNumber}
                              </span>
                              <span className="font-medium text-gray-100">
                                {formatSeconds(scene.duration)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {scene.sceneTitle || scene.sceneDescription || "Untitled scene"} |{" "}
                              {scene.shotCount} shot{scene.shotCount === 1 ? "" : "s"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "soundtrack" | "voiceover")
              }
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="border border-gray-800 bg-gray-900/70">
                  <TabsTrigger
                    value="soundtrack"
                    className="data-[state=active]:bg-white data-[state=active]:text-black"
                  >
                    Soundtrack
                  </TabsTrigger>
                  <TabsTrigger
                    value="voiceover"
                    className="data-[state=active]:bg-white data-[state=active]:text-black"
                  >
                    Voiceover
                  </TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
                    {"BGM -> music track | Voiceover -> narration"}
                  </Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={handleGenerateBoth}
                    disabled={
                      !canGenerate ||
                      !canGenerateVoiceover ||
                      isGenerating ||
                      isVoiceoverGenerating
                    }
                  >
                    {isGenerating || isVoiceoverGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Generate both tracks
                  </Button>
                </div>
              </div>

              <TabsContent value="soundtrack" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[2fr_1.2fr]">
                  <Card className="border-gray-800 bg-gray-950/70">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle>Soundtrack prompt & controls</CardTitle>
                        <CardDescription className="text-gray-400">
                          Auto-filled from storyboard visuals; edit to steer vibe or genre.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (generatedPrompt) {
                            setPromptValue(generatedPrompt.prompt);
                            setNegativePromptValue(generatedPrompt.negativePrompt);
                          }
                        }}
                        disabled={!generatedPrompt}
                      >
                        <Wand2 className="h-4 w-4" />
                        Use storyboard prompt
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-300">Music prompt</p>
                        </div>
                        <Textarea
                          value={promptValue}
                          onChange={(e) => setPromptValue(e.target.value)}
                          className="min-h-[140px] border-gray-800 bg-black/40"
                          placeholder="Cinematic underscore that matches the shots..."
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm text-gray-300">Negative prompt</p>
                          <Textarea
                            value={negativePromptValue}
                            onChange={(e) => setNegativePromptValue(e.target.value)}
                            className="min-h-[100px] border-gray-800 bg-black/40"
                            placeholder="dialogue, speech, vocals, narration, ..."
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-gray-300">Seed (optional)</p>
                          <Input
                            value={seedValue}
                            onChange={(e) => setSeedValue(e.target.value)}
                            placeholder="Leave blank for random"
                            className="border-gray-800 bg-black/40"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {generationError && (
                          <span className="text-xs text-amber-300">
                            {generationError}
                          </span>
                        )}
                        <Button
                          className="bg-white text-black hover:bg-gray-200"
                          onClick={handleGenerate}
                          disabled={!canGenerate}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating soundtrack...
                            </>
                          ) : (
                            "Generate soundtrack"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-800 bg-gray-950/70">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle>Soundtrack preview</CardTitle>
                        <CardDescription className="text-gray-400">
                          Saved to the music track automatically.
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-gray-300 hover:text-white"
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {lastUrl || soundtrackUrl ? (
                        <>
                          <AudioPlayer
                            src={lastUrl ?? soundtrackUrl ?? undefined}
                            label="Generated soundtrack"
                            className="w-full"
                          />
                          {!withinTolerance && (
                            <div className="text-xs text-amber-300">
                              Off target by {formatSeconds(durationDelta)}. Regenerate to tighten sync.
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => router.push(`/${projectId}/editor`)}
                              disabled={
                                !soundtrackUrl &&
                                !lastUrl &&
                                !voiceoverUrl &&
                                !voiceoverAsset
                              }
                            >
                              Continue to Video Editor
                            </Button>
                            {(soundtrackUrl || lastUrl) && (
                              <Button asChild variant="ghost">
                                <a
                                  href={soundtrackUrl ?? lastUrl ?? undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Download
                                </a>
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Soundtrack stays on the BGM track so you can mix it under the voiceover.
                          </p>
                        </>
                      ) : (
                        <div className="space-y-2 rounded-lg border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">
                          <p>No soundtrack yet.</p>
                          <p className="text-xs text-gray-500">
                            Generate with the controls on the left; it will land in the BGM track automatically.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="voiceover" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[2fr_1.2fr]">
                  <Card className="border-gray-800 bg-gray-950/70">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Mic2 className="h-4 w-4 text-emerald-400" />
                          Voiceover script & tone
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          Auto-generated from your storyboard for a quick product read.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleGenerateScript}
                        disabled={isScriptGenerating || !projectId}
                      >
                        {isScriptGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        Generate ad script (OpenAI)
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-300">Ad-style script</p>
                          <Badge variant="outline" className="text-gray-400">
                            {voiceoverScript.trim().split(/\s+/).filter(Boolean).length} words
                          </Badge>
                        </div>
                        <Textarea
                          value={voiceoverScript}
                          onChange={(e) => setVoiceoverScript(e.target.value)}
                          className="min-h-[160px] border-gray-800 bg-black/40"
                          placeholder="Narrate the product, call out the win, end with a CTA..."
                        />
                        {voiceoverError && (
                          <p className="text-xs text-amber-300">{voiceoverError}</p>
                        )}
                      </div>
                      <Separator className="bg-gray-800" />
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm text-gray-300">Voice</p>
                          <Select
                            value={voiceoverVoiceId}
                            onValueChange={(value) =>
                              setVoiceoverVoiceId(value as MiniMaxVoiceId)
                            }
                          >
                            <SelectTrigger className="border-gray-800 bg-black/40">
                              <SelectValue placeholder="Choose a voice" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(MINIMAX_VOICES).map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium">
                                      {voice.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {voice.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">
                            Powered by MiniMax speech-02-turbo via Replicate.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-gray-300">Emotion</p>
                          <Select
                            value={voiceoverEmotion}
                            onValueChange={(value) =>
                              setVoiceoverEmotion(value as MiniMaxEmotion)
                            }
                          >
                            <SelectTrigger className="border-gray-800 bg-black/40">
                              <SelectValue placeholder="auto" />
                            </SelectTrigger>
                            <SelectContent>
                              {MINIMAX_EMOTIONS.map((emotionOption) => (
                                <SelectItem key={emotionOption} value={emotionOption}>
                                  {emotionOption}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>Speed</span>
                            <span>{voiceoverSpeed.toFixed(2)}x</span>
                          </div>
                          <Slider
                            min={0.5}
                            max={2}
                            step={0.05}
                            value={[voiceoverSpeed]}
                            onValueChange={(value) =>
                              setVoiceoverSpeed(Number(value[0]?.toFixed(2) ?? 1))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>Pitch</span>
                            <span>
                              {voiceoverPitch > 0 ? `+${voiceoverPitch}` : voiceoverPitch}
                            </span>
                          </div>
                          <Slider
                            min={-12}
                            max={12}
                            step={1}
                            value={[voiceoverPitch]}
                            onValueChange={(value) =>
                              setVoiceoverPitch(Math.round(value[0] ?? 0))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <Button
                          className="bg-white text-black hover:bg-gray-200"
                          onClick={handleGenerateVoiceover}
                          disabled={!canGenerateVoiceover}
                        >
                          {isVoiceoverGenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating voiceover...
                            </>
                          ) : (
                            "Generate voiceover"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-800 bg-gray-950/70">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle>Voiceover preview</CardTitle>
                        <CardDescription className="text-gray-400">
                          Dropped into the narration track for mixing.
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-gray-300 hover:text-white"
                        onClick={handleGenerateVoiceover}
                        disabled={!canGenerateVoiceover}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {voiceoverUrl || voiceoverAsset ? (
                        <>
                          <AudioPlayer
                            src={voiceoverUrl ?? voiceoverAsset?.url ?? undefined}
                            label="Ad voiceover"
                            className="w-full"
                          />
                          {!voiceoverWithinTolerance &&
                            voiceoverDurationDelta !== null && (
                              <div className="text-xs text-amber-300">
                                Off target by {formatSeconds(voiceoverDurationDelta)} - trim or regenerate for tighter sync.
                              </div>
                            )}
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => router.push(`/${projectId}/editor`)}
                              disabled={
                                !voiceoverUrl &&
                                !voiceoverAsset &&
                                !soundtrackUrl &&
                                !lastUrl
                              }
                            >
                              Continue to Video Editor
                            </Button>
                            {(voiceoverUrl || voiceoverAsset) && (
                              <Button asChild variant="ghost">
                                <a
                                  href={voiceoverUrl ?? voiceoverAsset?.url ?? undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Download
                                </a>
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Voiceover sits on its own narration track; your soundtrack stays on BGM so you can mix levels later.
                          </p>
                        </>
                      ) : (
                        <div className="space-y-2 rounded-lg border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">
                          <p>No voiceover yet.</p>
                          <p className="text-xs text-gray-500">
                            Use the script + tone controls to generate an ad-style read; it will be placed on a separate track.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioPage;
