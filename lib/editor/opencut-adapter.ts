import type { Project, MediaAssetMeta, Sequence, Track, Clip } from "./types";

// Placeholder OpenCut types – adjust once actual library types are available
export interface OpenCutMediaItem {
  id: string;
  type: "video" | "audio" | "image";
  title?: string;
  src: string;
  thumbnailUrl?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface OpenCutClip {
  id: string;
  mediaId: string;
  trackId: string;
  start: number;
  duration: number;
}

export interface OpenCutTrack {
  id: string;
  kind: Track["kind"];
  name?: string;
  clips: OpenCutClip[];
}

export interface OpenCutSequence {
  id: string;
  name: string;
  duration: number;
  tracks: OpenCutTrack[];
}

export interface OpenCutProjectSnapshot {
  id: string;
  title: string;
  sequences: OpenCutSequence[];
  media: OpenCutMediaItem[];
}

export interface ProjectPatch {
  id: string;
  title: string;
  sequences: Sequence[];
  mediaAssets: Record<string, MediaAssetMeta>;
}

const clone = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

export const buildOpenCutProject = (
  project: Project,
  mediaAssets: MediaAssetMeta[],
): OpenCutProjectSnapshot => {
  const media: OpenCutMediaItem[] = mediaAssets.map((asset) => ({
    id: asset.id,
    type: asset.type,
    title: asset.name,
    src: asset.proxyUrl ?? asset.url,
    thumbnailUrl: asset.thumbnails?.[0],
    duration: asset.duration,
    metadata: {
      // pragma: allowlist secret
      r2Key: asset.r2Key,
      convexAssetId: asset.convexAssetId,
    },
  }));

  const sequences: OpenCutSequence[] = project.sequences.map((sequence) => ({
    id: sequence.id,
    name: sequence.name,
    duration: sequence.duration,
    tracks: sequence.tracks.map((track) => ({
      id: track.id,
      kind: track.kind,
      clips: track.clips.map((clip) => ({
        id: clip.id,
        mediaId: clip.mediaId,
        trackId: track.id,
        start: clip.start,
        duration: clip.duration,
      })),
    })),
  }));

  return {
    id: project.id,
    title: project.title,
    sequences,
    media,
  };
};

export const extractCanonicalSnapshot = (
  snapshot: OpenCutProjectSnapshot,
  originalProject: Project,
): ProjectPatch => {
  const sequenceById = new Map<string, Sequence>();
  for (const seq of originalProject.sequences) {
    sequenceById.set(seq.id, clone(seq));
  }

  const sequences: Sequence[] = snapshot.sequences.map((ocSeq) => {
    const base = sequenceById.get(ocSeq.id);
    const next: Sequence =
      base ?? {
        id: ocSeq.id,
        name: ocSeq.name,
        width: originalProject.sequences[0]?.width ?? 1920,
        height: originalProject.sequences[0]?.height ?? 1080,
        fps: originalProject.sequences[0]?.fps ?? 30,
        sampleRate: originalProject.sequences[0]?.sampleRate ?? 48000,
        duration: ocSeq.duration,
        tracks: [],
      };

    const trackById = new Map<string, Track>();
    const previousTrackClips = new Map<string, Clip[]>();
    for (const track of next.tracks) {
      previousTrackClips.set(track.id, track.clips.map((clip) => ({ ...clip })));
      trackById.set(track.id, track);
      track.clips = [];
    }

    for (const ocTrack of ocSeq.tracks) {
      let track = trackById.get(ocTrack.id);
      if (!track) {
        const siblingIndex = next.tracks.filter((t) => t.kind === ocTrack.kind).length + 1;
        const derivedName =
          ocTrack.name ?? `${ocTrack.kind === "audio" ? "Audio" : "Video"} ${siblingIndex}`;
        track = {
          id: ocTrack.id,
          name: derivedName,
          kind: ocTrack.kind,
          allowOverlap: ocTrack.kind !== "video",
          locked: false,
          muted: false,
          solo: false,
          volume: 1,
          zIndex: ocTrack.kind === "video" ? siblingIndex : 0,
          height: ocTrack.kind === "audio" ? 80 : 120,
          visible: true,
          clips: [],
        };
        next.tracks.push(track);
        trackById.set(track.id, track);
      }

      const existingClips = previousTrackClips.get(track.id) ?? [];
      track.clips = ocTrack.clips.map<Clip>((ocClip) => {
        const existing = existingClips.find((c) => c.id === ocClip.id);
        return {
          id: ocClip.id,
          mediaId: ocClip.mediaId,
          trackId: track!.id,
          kind: existing?.kind ?? "video",
          start: ocClip.start,
          duration: ocClip.duration,
          trimStart: existing?.trimStart ?? 0,
          trimEnd: existing?.trimEnd ?? 0,
          opacity: existing?.opacity ?? 1,
          volume: existing?.volume ?? 1,
          effects: existing?.effects ?? [],
          transitions: existing?.transitions ?? [],
          speedCurve: existing?.speedCurve ?? null,
          preservePitch: existing?.preservePitch ?? true,
          blendMode: existing?.blendMode ?? "normal",
        };
      });
    }

    next.duration = ocSeq.duration;
    return next;
  });

  const mediaAssets: Record<string, MediaAssetMeta> = { ...originalProject.mediaAssets };

  for (const item of snapshot.media) {
    const existing = mediaAssets[item.id];
    if (!existing) continue;
    mediaAssets[item.id] = {
      ...existing,
      name: item.title ?? existing.name,
      url: existing.url,
      proxyUrl: existing.proxyUrl,
    };
  }

  return {
    id: originalProject.id,
    title: snapshot.title ?? originalProject.title,
    sequences,
    mediaAssets,
  };
};
