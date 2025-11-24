import type { Doc } from "@/convex/_generated/dataModel";
import type { Clip, MediaAssetMeta, Project, Sequence, Track } from "./types";
import { buildAssetUrl } from "./io/asset-url";

type ConvexProject = Doc<"videoProjects">;
type ConvexClip = Doc<"videoClips">;
type ConvexScene = Doc<"scenes">;
type ConvexAudioAsset = Doc<"audioAssets">;

const DEFAULT_RESOLUTION = { width: 1920, height: 1080 };
const DEFAULT_FPS = 30;
const DEFAULT_SAMPLE_RATE = 44100;
const NARRATION_TRACK_ID = "audio-narration";
const BGM_TRACK_ID = "audio-bgm";
const SFX_TRACK_ID = "audio-sfx";
const TRACK_SETTING_KEY_MAP = {
  [NARRATION_TRACK_ID]: "audioNarration",
  [BGM_TRACK_ID]: "audioBgm",
  [SFX_TRACK_ID]: "audioSfx",
} as const;

const getDefaultVolumeForTrack = (trackId: string) => {
  if (trackId === BGM_TRACK_ID) return 0.55;
  if (trackId === SFX_TRACK_ID) return 0.95;
  return 1;
};

const parseResolution = (value?: string | null) => {
  if (!value) return DEFAULT_RESOLUTION;
  const byX = value.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (byX) {
    return {
      width: Number.parseInt(byX[1] ?? "0", 10) || DEFAULT_RESOLUTION.width,
      height: Number.parseInt(byX[2] ?? "0", 10) || DEFAULT_RESOLUTION.height,
    };
  }
  const justHeight = value.match(/(\d{3,4})p/i);
  if (justHeight) {
    const height =
      Number.parseInt(justHeight[1] ?? "0", 10) || DEFAULT_RESOLUTION.height;
    return { width: Math.round((height * 16) / 9), height };
  }
  return DEFAULT_RESOLUTION;
};

const buildMediaAsset = (
  clip: ConvexClip,
  scene: ConvexScene | undefined,
  index: number,
): MediaAssetMeta => {
  const { width, height } = parseResolution(clip.resolution);
  const name = scene
    ? `Scene ${scene.sceneNumber}: ${scene.description.slice(0, 42)}`
    : `Clip ${index + 1}`;
  const safeDuration = Math.max(clip.duration ?? 0, 0.1);
  const videoUrl =
    clip.lipsyncVideoUrl ??
    scene?.lipsyncVideoUrl ??
    clip.videoUrl ??
    clip.originalVideoUrl ??
    "";

  // Prefer proxies for interactive playback, but keep the raw source for fallback/export.
  // `sourceUrl` should point to the original (Replicate/R2) URL; `proxyUrl` is already a full URL.
  const originalUrl = clip.sourceUrl ?? clip.videoUrl ?? videoUrl;
  const proxyUrl = clip.proxyUrl ?? undefined;
  const playbackUrl = proxyUrl ?? originalUrl;

  return {
    id: clip._id,
    name,
    type: "video",
    duration: safeDuration,
    width,
    height,
    fps: DEFAULT_FPS,
    url: playbackUrl,
    r2Key: clip.r2Key ?? undefined,
    proxyUrl,
    proxyR2Key: proxyUrl ? (clip.r2Key ?? undefined) : undefined,
    sourceUrl: originalUrl,
    // Map beat analysis fields from videoClip
    beatMarkers: clip.beatMarkers,
    bpm: clip.bpm,
  };
};

const buildClip = (
  asset: MediaAssetMeta,
  start: number,
  trackId: string,
): Clip => ({
  id: asset.id,
  mediaId: asset.id,
  trackId,
  kind: "video",
  start,
  duration: asset.duration,
  trimStart: 0,
  trimEnd: 0,
  opacity: 1,
  volume: 1,
  effects: [],
  transitions: [],
  speedCurve: null,
  preservePitch: true,
  blendMode: "normal",
});

export interface ConvexEditorDataset {
  project: ConvexProject;
  clips: ConvexClip[];
  scenes: ConvexScene[];
  audioAssets?: ConvexAudioAsset[];
}

export interface AdaptedProject {
  project: Project;
  signature: string;
  readyClipCount: number;
}

export const adaptConvexProjectToStandalone = ({
  project,
  clips,
  scenes,
  audioAssets = [],
}: ConvexEditorDataset): AdaptedProject => {
  const scenesById = new Map(scenes.map((scene) => [scene._id, scene]));
  const sceneSignature = scenes
    .slice()
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((scene) => `${scene._id}:${scene.sceneNumber}:${scene.updatedAt}`)
    .join("|");

  const readyClips = clips
    .filter(
      (clip) => clip.status === "complete" && typeof clip.videoUrl === "string",
    )
    .map((clip) => ({
      clip,
      scene: scenesById.get(clip.sceneId),
    }))
    .sort((a, b) => {
      const sceneA = a.scene?.sceneNumber ?? Number.MAX_SAFE_INTEGER;
      const sceneB = b.scene?.sceneNumber ?? Number.MAX_SAFE_INTEGER;
      if (sceneA === sceneB) {
        return a.clip.createdAt - b.clip.createdAt;
      }
      return sceneA - sceneB;
    });

  const mediaAssets: Record<string, MediaAssetMeta> = {};
  const clipsForTrack: Clip[] = [];
  const clipBuckets: Record<string, Clip[]> = {
    [NARRATION_TRACK_ID]: [],
    [BGM_TRACK_ID]: [],
    [SFX_TRACK_ID]: [],
  };
  const narrationClips = clipBuckets[NARRATION_TRACK_ID];
  const bgmClips = clipBuckets[BGM_TRACK_ID];
  const sfxClips = clipBuckets[SFX_TRACK_ID];

  const sceneTimings = new Map<string, { start: number; duration: number }>();
  let cursor = 0;
  let sequenceResolution = DEFAULT_RESOLUTION;
  let timelineExtent = 0;
  let clipCounter = 0;
  const audioAssetsByScene = new Map<string, ConvexAudioAsset[]>();
  audioAssets.forEach((asset) => {
    if (asset.sceneId) {
      const key = asset.sceneId as string;
      const bucket = audioAssetsByScene.get(key) ?? [];
      bucket.push(asset);
      audioAssetsByScene.set(key, bucket);
    }
  });
  const hasProjectLevelBgmAsset = audioAssets.some(
    (asset) => asset.type === "bgm" && !asset.sceneId,
  );

  const registerAudioAsset = (
    assetId: string,
    params: { name: string; url: string; duration: number },
  ) => {
    mediaAssets[assetId] = {
      id: assetId,
      name: params.name,
      type: "audio",
      duration: params.duration,
      width: 0,
      height: 0,
      fps: DEFAULT_FPS,
      sampleRate: DEFAULT_SAMPLE_RATE,
      url: params.url,
    };
  };

  const addAudioClip = ({
    assetId,
    name,
    url,
    trackId,
    start,
    duration,
    volume,
  }: {
    assetId: string;
    name: string;
    url: string;
    trackId: string;
    start: number;
    duration: number;
    volume?: number;
  }) => {
    if (!url || !clipBuckets[trackId]) {
      return;
    }
    const safeDuration = Math.max(duration, 0.1);
    registerAudioAsset(assetId, { name, url, duration: safeDuration });
    const clip: Clip = {
      id: `${assetId}-clip-${clipCounter++}`,
      mediaId: assetId,
      trackId,
      kind: "audio",
      start,
      duration: safeDuration,
      trimStart: 0,
      trimEnd: 0,
      opacity: 1,
      volume: volume ?? getDefaultVolumeForTrack(trackId),
      effects: [],
      transitions: [],
      speedCurve: null,
      preservePitch: true,
      blendMode: "normal",
    };
    clipBuckets[trackId].push(clip);
    timelineExtent = Math.max(timelineExtent, clip.start + clip.duration);
  };

  readyClips.forEach(({ clip, scene }, index) => {
    const asset = buildMediaAsset(clip, scene, index);
    const startTime = cursor;
    if (asset.width && asset.height) {
      sequenceResolution = { width: asset.width, height: asset.height };
    }
    mediaAssets[asset.id] = asset;
    clipsForTrack.push(buildClip(asset, startTime, "video-1"));

    if (scene?._id) {
      sceneTimings.set(scene._id, {
        start: startTime,
        duration: asset.duration,
      });
    }

    const sceneAssetBucket = scene?._id
      ? (audioAssetsByScene.get(scene._id as string) ?? [])
      : [];
    const hasSceneNarrationAsset = sceneAssetBucket.some(
      (asset) => asset.type === "narration",
    );
    const hasSceneBgmAsset = sceneAssetBucket.some(
      (asset) => asset.type === "bgm",
    );

    if (scene?.narrationUrl && !hasSceneNarrationAsset) {
      const audioAssetId = `${scene._id}-narration`;
      addAudioClip({
        assetId: audioAssetId,
        name: `Scene ${scene.sceneNumber}: Narration`,
        url: scene.narrationUrl,
        trackId: NARRATION_TRACK_ID,
        start: startTime,
        duration: asset.duration,
        volume: 1,
      });
    }

    if (scene?.backgroundMusicUrl && !hasSceneBgmAsset) {
      addAudioClip({
        assetId: `${scene._id}-bgm`,
        name: `Scene ${scene.sceneNumber}: Background`,
        url: scene.backgroundMusicUrl,
        trackId: BGM_TRACK_ID,
        start: startTime,
        duration: asset.duration,
        volume: getDefaultVolumeForTrack(BGM_TRACK_ID),
      });
    }

    cursor += asset.duration;
  });

  if (project.soundtrackUrl && !hasProjectLevelBgmAsset) {
    addAudioClip({
      assetId: `${project._id}-soundtrack`,
      name: "Project Soundtrack",
      url: project.soundtrackUrl,
      trackId: BGM_TRACK_ID,
      start: 0,
      duration:
        typeof project.soundtrackDuration === "number"
          ? Math.max(project.soundtrackDuration, 0.1)
          : Math.max(cursor, 1),
      volume: getDefaultVolumeForTrack(BGM_TRACK_ID),
    });
  } else if (project.backgroundMusicUrl && !hasProjectLevelBgmAsset) {
    addAudioClip({
      assetId: `${project._id}-project-bgm`,
      name: "Project Background Music",
      url: project.backgroundMusicUrl,
      trackId: BGM_TRACK_ID,
      start: 0,
      duration: Math.max(cursor, 1),
      volume: getDefaultVolumeForTrack(BGM_TRACK_ID),
    });
  }

  audioAssets.forEach((asset) => {
    const trackId =
      asset.type === "bgm"
        ? BGM_TRACK_ID
        : asset.type === "sfx"
          ? SFX_TRACK_ID
          : NARRATION_TRACK_ID;

    const sceneTiming = asset.sceneId
      ? sceneTimings.get(asset.sceneId as string)
      : undefined;

    const fallbackStart = sceneTiming?.start ?? 0;
    const clipStart =
      typeof asset.timelineStart === "number"
        ? Math.max(0, asset.timelineStart)
        : fallbackStart;

    const derivedDuration =
      typeof asset.duration === "number"
        ? asset.duration
        : typeof asset.timelineEnd === "number"
          ? Math.max(asset.timelineEnd - clipStart, 0.1)
          : (sceneTiming?.duration ?? Math.max(cursor, 1));

    const metadataVolume =
      typeof asset.metadata === "object" &&
      asset.metadata !== null &&
      typeof (asset.metadata as { volume?: unknown }).volume === "number"
        ? Number((asset.metadata as { volume: number }).volume)
        : undefined;

    const name =
      asset.mood && asset.mood.length > 0
        ? `${asset.type.toUpperCase()}: ${asset.mood}`
        : `Audio Asset ${asset._id}`;

    addAudioClip({
      assetId: asset._id,
      name,
      url: asset.url,
      trackId,
      start: clipStart,
      duration: derivedDuration,
      volume: metadataVolume ?? getDefaultVolumeForTrack(trackId),
    });
  });

  const videoTrack: Track = {
    id: "video-1",
    name: "Video",
    kind: "video",
    allowOverlap: false,
    locked: false,
    muted: false,
    solo: false,
    volume: 1,
    zIndex: 0,
    height: 64,
    visible: true,
    clips: clipsForTrack,
  };

  const narrationTrack: Track = {
    id: NARRATION_TRACK_ID,
    name: "Narration",
    kind: "audio",
    allowOverlap: false,
    locked: false,
    muted: false,
    solo: false,
    volume: 1,
    zIndex: 0,
    height: 64,
    visible: true,
    clips: narrationClips,
  };

  const bgmTrack: Track = {
    id: BGM_TRACK_ID,
    name: "BGM",
    kind: "audio",
    allowOverlap: true,
    locked: false,
    muted: false,
    solo: false,
    volume: 1,
    zIndex: 0,
    height: 64,
    visible: true,
    clips: bgmClips,
  };

  const sfxTrack: Track = {
    id: SFX_TRACK_ID,
    name: "SFX",
    kind: "audio",
    allowOverlap: true,
    locked: false,
    muted: false,
    solo: false,
    volume: 1,
    zIndex: 0,
    height: 64,
    visible: true,
    clips: sfxClips,
  };
  const audioTrackSettings = project.audioTrackSettings ?? {};
  const applyTrackSettings = (track: Track) => {
    const settingsKey =
      TRACK_SETTING_KEY_MAP[track.id as keyof typeof TRACK_SETTING_KEY_MAP];
    if (!settingsKey) return;
    const settings = audioTrackSettings[settingsKey];
    if (!settings) return;
    if (typeof settings.volume === "number") {
      track.volume = settings.volume;
    }
    if (typeof settings.muted === "boolean") {
      track.muted = settings.muted;
    }
  };
  [narrationTrack, bgmTrack, sfxTrack].forEach(applyTrackSettings);

  const clipCollectionEnd = (collection: Clip[]) =>
    collection.reduce(
      (maxEnd, clip) => Math.max(maxEnd, clip.start + clip.duration),
      0,
    );

  const audioTimelineEnd = Math.max(
    timelineExtent,
    clipCollectionEnd(narrationClips),
    clipCollectionEnd(bgmClips),
    clipCollectionEnd(sfxClips),
  );
  const sequenceDuration = Math.max(cursor, audioTimelineEnd);

  const sequence: Sequence = {
    id: `sequence-${project._id}`,
    name: "Main Sequence",
    width: sequenceResolution.width,
    height: sequenceResolution.height,
    fps: DEFAULT_FPS,
    sampleRate: DEFAULT_SAMPLE_RATE,
    duration: sequenceDuration,
    tracks: [videoTrack, narrationTrack, bgmTrack, sfxTrack],
  };

  const adapted: Project = {
    id: project._id,
    title: project.prompt || "AI Video Project",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sequences: [sequence],
    mediaAssets,
    settings: {
      snap: true,
      snapThreshold: 0.1,
      zoom: 1,
      activeSequenceId: sequence.id,
    },
  };

  const clipSignature = readyClips
    .map(({ clip }) => `${clip._id}:${clip.updatedAt}:${clip.videoUrl ?? ""}`)
    .join("|");

  const audioAssetSignature = audioAssets
    .slice()
    .sort((a, b) => a._id.localeCompare(b._id))
    .map(
      (asset) =>
        `${asset._id}:${asset.updatedAt}:${asset.url}:${asset.timelineStart ?? ""}:${asset.timelineEnd ?? ""}:${asset.type}`,
    )
    .join("|");

  const signature = [
    project._id,
    project.updatedAt,
    readyClips.length,
    sceneSignature,
    clipSignature,
    audioAssetSignature,
  ].join("::");

  return {
    project: adapted,
    signature,
    readyClipCount: readyClips.length,
  };
};
