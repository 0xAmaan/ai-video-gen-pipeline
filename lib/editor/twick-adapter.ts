"use client";

import type { ElementJSON, ProjectJSON, TrackJSON } from "@twick/timeline/dist/types";
import type { Project, Track, Clip, MediaAssetMeta } from "./types";

// Guardrail: ensure clips only live on compatible tracks (audio on audio tracks, everything else on video/overlay)
const isClipAllowedOnTrack = (clipKind: Clip["kind"], trackKind: Track["kind"]) => {
  const trackType = trackKind === "audio" ? "audio" : "video";
  if (clipKind === "audio") return trackType === "audio";
  return trackType === "video";
};

const mapTrackType = (type?: string): Track["kind"] => {
  if (type === "audio") return "audio";
  if (type === "overlay") return "video";
  return "video";
};

export const projectToTimelineJSON = (project: Project): ProjectJSON => {
  const activeSequence =
    project.sequences.find((seq) => seq.id === project.settings.activeSequenceId) ??
    project.sequences[0];
  const assets = project.mediaAssets;

  const friendlyName = (track: Track) => {
    if (track.id === "video-1") return "🎬 Video";
    if (track.id === "audio-narration") return "🔊 Narration";
    if (track.id === "audio-bgm") return "🎵 Music";
    if (track.id === "audio-sfx") return "🔊 SFX";
    return track.kind === "audio" ? "🔊 Audio" : "🎬 Video";
  };

  const tracks: TrackJSON[] = activeSequence.tracks.map((track) => ({
    id: track.id,
    name: friendlyName(track),
    type: track.kind,
    elements: track.clips.map((clip) => clipToElement(clip, assets[clip.mediaId])),
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
    project.sequences.find((seq) => seq.id === project.settings.activeSequenceId) ??
    project.sequences[0];
  const timelineTracks = timeline.tracks ?? [];

  const convertedTracks = timelineTracks.map((track, index) => ({
    id: track.id,
    name: track.id,
    kind: mapTrackType(track.type),
    allowOverlap: track.type !== "video",
    locked: false,
    muted: false,
    solo: false,
    volume: 1,
    zIndex: track.type === "video" ? Math.max(0, timelineTracks.length - index) : 0,
    height: track.type === "audio" ? 80 : 120,
    visible: true,
    clips: track.elements.map((element) => elementToClip(element, track.id, assets)),
  }));

  // Validate track/clip compatibility before accepting Twick state
  for (const track of convertedTracks) {
    for (const clip of track.clips) {
      if (!isClipAllowedOnTrack(clip.kind, track.kind)) {
        console.warn("[TwickAdapter] Rejecting incompatible clip-track pairing", {
          clipId: clip.id,
          clipKind: clip.kind,
          trackId: track.id,
          trackKind: track.kind,
        });
        return base; // Keep existing project unchanged
      }
    }
  }

  sequence.tracks = convertedTracks;

  sequence.duration = sequence.tracks.reduce((max, track) => {
    const end = track.clips.reduce((clipMax, clip) => Math.max(clipMax, clip.start + clip.duration), 0);
    return Math.max(max, end);
  }, 0);

  project.updatedAt = Date.now();
  return project;
};

const clipToElement = (clip: Clip, asset?: MediaAssetMeta): ElementJSON => {
  // Validate and sanitize time values to prevent NaN/Infinity propagation
  const start = Number.isFinite(clip.start) && clip.start >= 0 ? clip.start : 0;
  const duration = Number.isFinite(clip.duration) && clip.duration > 0 ? clip.duration : 1;
  const trimStart = Number.isFinite(clip.trimStart) && clip.trimStart >= 0 ? clip.trimStart : 0;
  const trimEnd = Number.isFinite(clip.trimEnd) && clip.trimEnd >= 0 ? clip.trimEnd : 0;
  const opacity = Number.isFinite(clip.opacity) && clip.opacity >= 0 && clip.opacity <= 1 ? clip.opacity : 1;
  const volume = Number.isFinite(clip.volume) && clip.volume >= 0 ? clip.volume : 1;
  
  // Log warning if values were corrected
  if (clip.start !== start || clip.duration !== duration) {
    console.warn('[TwickAdapter] clipToElement: Invalid time values corrected', {
      clipId: clip.id,
      original: { start: clip.start, duration: clip.duration },
      corrected: { start, duration },
    });
  }
  
  return {
    id: clip.id,
    type: clip.kind,
    name: asset?.name ?? `Clip ${clip.id.slice(0, 8)}`,
    s: start,
    e: start + duration,
    props: {
      assetId: clip.mediaId,
      src: asset?.proxyUrl ?? asset?.url ?? asset?.sourceUrl ?? "",
      r2Key: asset?.r2Key,
      trimStart,
      trimEnd,
      opacity,
      volume,
      blendMode: clip.blendMode ?? "normal",
      // Timeline preview data (matching legacy editor)
      thumbnails: asset?.thumbnails ?? [],
      thumbnailCount: asset?.thumbnailCount ?? 0,
      assetName: asset?.name ?? "",
      assetType: asset?.type,
    },
  };
};

const elementToClip = (
  element: ElementJSON,
  trackId: string,
  assets: Record<string, MediaAssetMeta>,
): Clip => {
  // Validate and sanitize all numeric values from Twick
  const s = Number.isFinite(element.s) && element.s >= 0 ? element.s : 0;
  const e = Number.isFinite(element.e) && element.e > s ? element.e : s + 1;
  const duration = Math.max(0.1, e - s);
  
  const props = (element as any)?.props ?? {};
  const trimStart = Number.isFinite(props.trimStart) && props.trimStart >= 0 ? props.trimStart : 0;
  const trimEnd = Number.isFinite(props.trimEnd) && props.trimEnd >= 0 ? props.trimEnd : 0;
  const opacity = Number.isFinite(props.opacity) && props.opacity >= 0 && props.opacity <= 1 ? props.opacity : 1;
  const volume = Number.isFinite(props.volume) && props.volume >= 0 ? props.volume : 1;
  
  const assetId = props.assetId ?? element.id;
  const asset = assets[assetId];
  const clipKind: Clip["kind"] = element.type === "audio" ? "audio" : element.type === "image" ? "image" : "video";
  
  // Log warning if values were corrected
  if (!Number.isFinite(element.s) || !Number.isFinite(element.e) || element.s < 0 || element.e <= element.s) {
    console.warn('[TwickAdapter] elementToClip: Invalid time values corrected', {
      elementId: element.id,
      original: { s: element.s, e: element.e },
      corrected: { s, e, duration },
    });
  }
  
  return {
    id: element.id,
    mediaId: assetId,
    trackId,
    kind: clipKind,
    start: s,
    duration,
    trimStart,
    trimEnd,
    opacity,
    volume,
    blendMode: ((element as any)?.props?.blendMode as Clip["blendMode"]) ?? "normal",
    effects: [],
    transitions: [],
    speedCurve: null,
    preservePitch: true,
  };
};
