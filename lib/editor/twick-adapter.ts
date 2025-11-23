"use client";

import type {
  ElementJSON,
  ProjectJSON,
  TrackJSON,
} from "@twick/timeline/dist/types";
import type { Project, Track, Clip, MediaAssetMeta } from "./types";

const mapTrackType = (type?: string): Track["kind"] => {
  if (type === "audio") return "audio";
  if (type === "overlay") return "video";
  return "video";
};

export const projectToTimelineJSON = (project: Project): ProjectJSON => {
  const activeSequence =
    project.sequences.find(
      (seq) => seq.id === project.settings.activeSequenceId,
    ) ?? project.sequences[0];
  const assets = project.mediaAssets;

  const friendlyName = (track: Track) => {
    if (track.id === "video-1") return "Video";
    if (track.id === "audio-narration") return "Narration";
    if (track.id === "audio-bgm") return "Music";
    if (track.id === "audio-sfx") return "SFX";
    return track.kind === "audio" ? "Audio" : "Video";
  };

  const tracks: TrackJSON[] = activeSequence.tracks.map((track) => ({
    id: track.id,
    name: friendlyName(track),
    type: track.kind,
    elements: track.clips.map((clip) =>
      clipToElement(clip, assets[clip.mediaId]),
    ),
  }));

  return {
    tracks,
    version: project.updatedAt ?? Date.now(),
  };
};

export const timelineToProject = (
  base: Project,
  timeline: ProjectJSON,
  assets: Record<string, MediaAssetMeta>,
): Project => {
  const project: Project = structuredClone(base);
  const sequence =
    project.sequences.find(
      (seq) => seq.id === project.settings.activeSequenceId,
    ) ?? project.sequences[0];
  const timelineTracks = timeline.tracks ?? [];

  sequence.tracks = timelineTracks.map((track, index) => ({
    id: track.id,
    name: track.id,
    kind: mapTrackType(track.type),
    allowOverlap: track.type !== "video",
    locked: false,
    muted: false,
    solo: false,
    volume: 1,
    zIndex: index,
    height: 64,
    visible: true,
    clips: track.elements.map((element) =>
      elementToClip(element, track.id, assets),
    ),
  }));

  sequence.duration = sequence.tracks.reduce((max, track) => {
    const end = track.clips.reduce(
      (clipMax, clip) => Math.max(clipMax, clip.start + clip.duration),
      0,
    );
    return Math.max(max, end);
  }, 0);

  project.updatedAt = Date.now();
  return project;
};

const clipToElement = (clip: Clip, asset?: MediaAssetMeta): ElementJSON => ({
  id: clip.id,
  type: clip.kind,
  s: clip.start,
  e: clip.start + clip.duration,
  props: {
    assetId: clip.mediaId,
    src: asset?.proxyUrl ?? asset?.url ?? asset?.sourceUrl ?? "",
    r2Key: asset?.r2Key,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    opacity: clip.opacity,
    volume: clip.volume,
  },
});

const elementToClip = (
  element: ElementJSON,
  trackId: string,
  assets: Record<string, MediaAssetMeta>,
): Clip => {
  const duration = Math.max(0.1, (element.e ?? element.s) - element.s);
  const assetId = (element as any)?.props?.assetId ?? element.id;
  const asset = assets[assetId];
  const clipKind: Clip["kind"] =
    element.type === "audio"
      ? "audio"
      : element.type === "image"
        ? "image"
        : "video";
  return {
    id: element.id,
    mediaId: assetId,
    trackId,
    kind: clipKind,
    start: element.s,
    duration,
    trimStart: (element as any)?.props?.trimStart ?? 0,
    trimEnd: (element as any)?.props?.trimEnd ?? 0,
    opacity: (element as any)?.props?.opacity ?? 1,
    volume: (element as any)?.props?.volume ?? 1,
    effects: [],
    transitions: [],
    speedCurve: null,
    preservePitch: true,
    blendMode: "normal",
  };
};
