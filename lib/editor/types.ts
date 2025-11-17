export type TrackKind = "video" | "audio" | "overlay" | "fx";

export type EffectType =
  | "brightness"
  | "contrast"
  | "saturation"
  | "blur"
  | "custom";

export interface Effect {
  id: string;
  type: EffectType;
  params: Record<string, number>;
  enabled: boolean;
}

export type EasingFunction = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface TransitionSpec {
  id: string;
  type: string; // TransitionType from transitions/presets
  duration: number; // in seconds
  easing: EasingFunction; // easing function identifier (string instead of function for serialization)
}

export type ClipKind = "video" | "audio" | "image";

export interface Clip {
  id: string;
  mediaId: string;
  trackId: string;
  kind: ClipKind;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  opacity: number;
  volume: number;
  effects: Effect[];
  transitions: TransitionSpec[];
}

export interface Track {
  id: string;
  kind: TrackKind;
  allowOverlap: boolean;
  clips: Clip[];
  locked: boolean;
  muted: boolean;
  volume: number;
}

export interface Sequence {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  duration: number;
  tracks: Track[];
}

export interface MediaAssetMeta {
  id: string;
  name: string;
  type: "video" | "audio" | "image";
  duration: number;
  width: number;
  height: number;
  fps: number;
  waveform?: Float32Array;
  sampleRate?: number;
  url: string;
  waveformUrl?: string;
  thumbnails?: string[]; // Data URLs for timeline thumbnails
  thumbnailCount?: number;
}

export interface ProjectSettings {
  snap: boolean;
  zoom: number;
  activeSequenceId: string;
}

export interface Project {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  sequences: Sequence[];
  mediaAssets: Record<string, MediaAssetMeta>;
  settings: ProjectSettings;
}

export interface ExportJob {
  id: string;
  status: "idle" | "running" | "complete" | "failed" | "cancelled";
  progress: number;
  error?: string;
  etaSeconds?: number;
}

export interface TimelineSelection {
  clipIds: string[];
  trackIds: string[];
}

export interface WorkerProgressEvent {
  phase: "demux" | "effects" | "encode";
  progress: number;
  detail?: string;
}
