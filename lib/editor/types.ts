export type TrackKind = "video" | "audio" | "overlay" | "fx";

export type EffectType =
  | "brightness"
  | "contrast"
  | "saturation"
  | "blur"
  | "grain"
  | "colorGrade"
  | "vintage"
  | "vignette"
  | "filmLook"
  | "custom";

// Filter parameter interfaces (for type safety and documentation)
// All effects use flat params: Record<string, number> for consistency
// These interfaces document the expected parameter keys for each filter type

export interface GrainParams {
  intensity: number; // 0-1, amount of grain
  size: number; // 1-10, grain particle size
}

export interface ColorGradeParams {
  temperature: number; // -1 to 1, warm/cool shift
  tint: number; // -1 to 1, green/magenta shift
  shadows: number; // -1 to 1, darken/lighten shadows
  highlights: number; // -1 to 1, darken/lighten highlights
  saturation: number; // 0-2, color saturation multiplier
  contrast: number; // 0-2, contrast multiplier
}

export interface VintageParams {
  fade: number; // 0-1, overall fade/wash effect
  sepia: number; // 0-1, sepia tone intensity
  vignette: number; // 0-1, vignette intensity
  grain: number; // 0-1, film grain amount
}

export interface VignetteParams {
  intensity: number; // 0-1, darkness of vignette
  radius: number; // 0-1, size of vignette (0=small, 1=large)
  softness: number; // 0-1, edge feathering
}

export interface FilmLookParams {
  grain: number; // 0-1, film grain intensity
  halation: number; // 0-1, light bloom effect
  contrast: number; // 0-2, contrast curve
  colorShift: number; // -1 to 1, color temperature shift
}

export interface Effect {
  id: string;
  type: EffectType;
  params: Record<string, number>; // Flat structure for all effect types
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

export interface SpeedKeyframe {
  time: number; // Normalized 0-1 representing position within clip
  speed: number; // Speed multiplier (0.5 = half speed, 2.0 = double speed, 0 = freeze frame)
}

export interface SpeedCurve {
  keyframes: SpeedKeyframe[];
}

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
  speedCurve: SpeedCurve | null; // null = normal speed (1x), otherwise custom speed curve
  preservePitch: boolean; // When true, attempt to preserve audio pitch during speed changes (default: true)
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
  r2Key?: string;
  proxyUrl?: string;
   proxyR2Key?: string;
  sourceUrl?: string;
  predictionId?: string;
  thumbnails?: string[]; // Data URLs for timeline thumbnails
  thumbnailCount?: number;
  beatMarkers?: Array<{ time: number; strength?: number }>; // Audio beat analysis data
  bpm?: number; // Beats per minute (for audio assets)
}

export interface ProjectSettings {
  snap: boolean;
  snapThreshold: number; // Distance in seconds within which snapping occurs
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
