import type { Doc } from "@/convex/_generated/dataModel";
import type {
  Clip,
  MediaAssetMeta,
  Project,
  Sequence,
  Track,
} from "./types";
import { buildAssetUrl } from "./io/asset-url";

type ConvexProject = Doc<"videoProjects">;
type ConvexClip = Doc<"videoClips">;
type ConvexScene = Doc<"scenes">;

const DEFAULT_RESOLUTION = { width: 1920, height: 1080 };
const DEFAULT_FPS = 30;
const DEFAULT_SAMPLE_RATE = 48000;

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
    const height = Number.parseInt(justHeight[1] ?? "0", 10) || DEFAULT_RESOLUTION.height;
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
  const baseUrl = clip.proxyUrl ?? clip.videoUrl ?? "";
  const url = buildAssetUrl(clip.r2Key, baseUrl);
  return {
    id: clip._id,
    name,
    type: "video",
    duration: safeDuration,
    width,
    height,
    fps: DEFAULT_FPS,
    url,
    r2Key: clip.r2Key ?? undefined,
    proxyUrl: clip.proxyUrl ? buildAssetUrl(clip.r2Key, clip.proxyUrl) : undefined,
    sourceUrl: clip.sourceUrl ?? undefined,
  };
};

const buildClip = (asset: MediaAssetMeta, start: number, trackId: string): Clip => ({
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
});

export interface ConvexEditorDataset {
  project: ConvexProject;
  clips: ConvexClip[];
  scenes: ConvexScene[];
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
}: ConvexEditorDataset): AdaptedProject => {
  const scenesById = new Map(scenes.map((scene) => [scene._id, scene]));
  const sceneSignature = scenes
    .slice()
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((scene) => `${scene._id}:${scene.sceneNumber}:${scene.updatedAt}`)
    .join("|");

  const readyClips = clips
    .filter((clip) => clip.status === "complete" && typeof clip.videoUrl === "string")
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
  let cursor = 0;
  let sequenceResolution = DEFAULT_RESOLUTION;

  readyClips.forEach(({ clip, scene }, index) => {
    const asset = buildMediaAsset(clip, scene, index);
    if (asset.width && asset.height) {
      sequenceResolution = { width: asset.width, height: asset.height };
    }
    mediaAssets[asset.id] = asset;
    clipsForTrack.push(buildClip(asset, cursor, "video-1"));
    cursor += asset.duration;
  });

  const videoTrack: Track = {
    id: "video-1",
    kind: "video",
    allowOverlap: false,
    locked: false,
    muted: false,
    clips: clipsForTrack,
  };

  const audioTrack: Track = {
    id: "audio-1",
    kind: "audio",
    allowOverlap: true,
    locked: false,
    muted: false,
    clips: [],
  };

  const sequence: Sequence = {
    id: `sequence-${project._id}`,
    name: "Main Sequence",
    width: sequenceResolution.width,
    height: sequenceResolution.height,
    fps: DEFAULT_FPS,
    sampleRate: DEFAULT_SAMPLE_RATE,
    duration: cursor,
    tracks: [videoTrack, audioTrack],
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
      zoom: 1,
      activeSequenceId: sequence.id,
    },
  };

  const clipSignature = readyClips
    .map(({ clip }) => `${clip._id}:${clip.updatedAt}:${clip.videoUrl ?? ""}`)
    .join("|");

  const signature = [
    project._id,
    project.updatedAt,
    readyClips.length,
    sceneSignature,
    clipSignature,
  ].join("::");

  return {
    project: adapted,
    signature,
    readyClipCount: readyClips.length,
  };
};
