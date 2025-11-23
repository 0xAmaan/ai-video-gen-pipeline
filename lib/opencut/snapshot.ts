import type { Project, MediaAssetMeta, Track, Clip } from "@/lib/editor/types";
import type { MediaFile } from "@opencut/types/media";
import type { TimelineTrack, TimelineElement } from "@opencut/types/timeline";
import type { TProject } from "@opencut/types/project";
import type { OpenCutSnapshot } from "./storage-service";

interface SnapshotOptions {
  signal?: AbortSignal;
  onAssetLoaded?: (params: { completed: number; total: number; name: string }) => void;
}

const MIME_FALLBACK: Record<string, string> = {
  video: "video/mp4",
  audio: "audio/mpeg",
  image: "image/jpeg",
};

const EXTENSION_FALLBACK: Record<string, string> = {
  video: "mp4",
  audio: "mp3",
  image: "png",
};

const clampDuration = (value: number | undefined): number => {
  if (!value || Number.isNaN(value)) {
    return 0.1;
  }
  return Math.max(value, 0.1);
};

const guessExtension = (asset: MediaAssetMeta, mime: string): string => {
  if (mime.includes("/")) {
    const [, subtype] = mime.split("/");
    if (subtype) return subtype.split(";")[0];
  }

  const byUrl = asset.url?.split("?")[0]?.split(".") ?? [];
  const candidate = byUrl[byUrl.length - 1];
  if (candidate && candidate.length <= 4) {
    return candidate.toLowerCase();
  }

  return EXTENSION_FALLBACK[asset.type] ?? "bin";
};

const buildFileName = (asset: MediaAssetMeta, mime: string): string => {
  const safeBase = asset.name.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase() || asset.id;
  const ext = guessExtension(asset, mime);
  return `${safeBase}.${ext}`;
};

const inferMimeType = (asset: MediaAssetMeta): string => MIME_FALLBACK[asset.type] ?? "application/octet-stream";

const toMediaElement = (clip: Clip, asset: MediaAssetMeta | undefined): TimelineElement => ({
  id: clip.id,
  name: asset?.name ?? clip.id,
  type: "media",
  mediaId: clip.mediaId,
  duration: clampDuration(clip.duration),
  startTime: clip.start,
  trimStart: clip.trimStart ?? 0,
  trimEnd: clip.trimEnd ?? 0,
  hidden: clip.opacity === 0,
});

const mapTrackKind = (track: Track): TimelineTrack["type"] => {
  if (track.kind === "audio") return "audio";
  return "media";
};

const downloadAssetFile = async (
  asset: MediaAssetMeta,
  signal?: AbortSignal,
): Promise<File> => {
  const sourceUrl = asset.proxyUrl ?? asset.url;
  if (!sourceUrl) {
    throw new Error(`Asset ${asset.id} has no accessible URL`);
  }

  const response = await fetch(sourceUrl, { signal, cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${asset.name}: ${response.status}`);
  }

  const blob = await response.blob();
  const mime = blob.type || inferMimeType(asset);
  const filename = buildFileName(asset, mime);
  return new File([blob], filename, { type: mime });
};

const toMediaFile = async (
  asset: MediaAssetMeta,
  options: SnapshotOptions,
): Promise<MediaFile> => {
  const file = await downloadAssetFile(asset, options.signal);
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    file,
    url: asset.proxyUrl ?? asset.url,
    thumbnailUrl: asset.thumbnails?.[0],
    duration: clampDuration(asset.duration),
    width: asset.width,
    height: asset.height,
    fps: asset.fps,
  };
};

const buildProject = (
  project: Project,
  primarySequence: Project["sequences"][number],
  thumbnailUrl?: string,
): TProject => {
  const sceneId = `${project.id}-scene`;
  const createdAt = new Date(project.createdAt ?? Date.now());
  const updatedAt = new Date(project.updatedAt ?? Date.now());
  const width = primarySequence.width || 1920;
  const height = primarySequence.height || 1080;
  const fps = primarySequence.fps || 30;

  return {
    id: project.id,
    name: project.title,
    thumbnail: thumbnailUrl ?? "",
    createdAt,
    updatedAt,
    scenes: [
      {
        id: sceneId,
        name: "Main Scene",
        isMain: true,
        createdAt,
        updatedAt,
      },
    ],
    currentSceneId: sceneId,
    backgroundColor: "#000000",
    backgroundType: "color",
    blurIntensity: 8,
    bookmarks: [],
    fps,
    canvasSize: {
      width,
      height,
    },
    canvasMode: "custom",
  };
};

export async function buildOpenCutSnapshot(
  project: Project,
  options: SnapshotOptions = {},
): Promise<OpenCutSnapshot> {
  const primarySequence = project.sequences[0];
  if (!primarySequence) {
    throw new Error("Project has no sequences to render in OpenCut");
  }

  const assetEntries = Object.entries(project.mediaAssets);
  const totalAssets = assetEntries.length;
  const mediaFiles: MediaFile[] = [];
  for (const [index, [, asset]] of assetEntries.entries()) {
    try {
      const mediaFile = await toMediaFile(asset, options);
      mediaFiles.push(mediaFile);
    } catch (error) {
      console.error(`Failed to download asset ${asset.name}`, error);
    } finally {
      options.onAssetLoaded?.({
        completed: index + 1,
        total: totalAssets,
        name: asset.name,
      });
    }
  }

  const assetMap = new Map<string, MediaAssetMeta>(assetEntries);
  const timeline: TimelineTrack[] = primarySequence.tracks.map((track) => ({
    id: track.id,
    name: track.id,
    type: mapTrackKind(track),
    elements: track.clips.map((clip) =>
      toMediaElement(clip, assetMap.get(clip.mediaId)),
    ),
    muted: track.muted,
    isMain: track.kind === "video",
  }));

  const firstMediaThumbnail = mediaFiles.find((item) => item.thumbnailUrl)?.thumbnailUrl;

  return {
    project: buildProject(project, primarySequence, firstMediaThumbnail),
    mediaFiles,
    timeline,
    sceneId: `${project.id}-scene`,
  };
}
