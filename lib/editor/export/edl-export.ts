/**
 * EDL (Edit Decision List) Export
 *
 * This module provides serialization of Project data to an EDL format
 * that can be consumed by render servers (e.g., FFmpeg-based pipelines).
 *
 * The EDL format preserves:
 * - Track order, opacity, and effects
 * - Clip effects, transitions, and speed curves
 * - Effect parameters with FFmpeg filter string mappings
 * - Media asset references
 */

import type {
  Project,
  Sequence,
  Track,
  Clip,
  Effect,
  TransitionSpec,
  SpeedCurve,
  MediaAssetMeta,
  EffectType,
  TrackKind,
  ClipKind,
  EasingFunction,
} from "../types";

// EDL Version for format compatibility tracking
export const EDL_VERSION = "1.0.0";

// ============================================================================
// EDL Type Definitions
// ============================================================================

export interface EDLEffect {
  id: string;
  type: EffectType;
  params: Record<string, number | string>;
  enabled: boolean;
  blend: number;
  order: number;
  ffmpegFilter: string | null; // Pre-computed FFmpeg filter string
}

export interface EDLTransition {
  id: string;
  type: string;
  duration: number;
  easing: EasingFunction;
}

export interface EDLSpeedCurve {
  keyframes: Array<{
    time: number;
    speed: number;
  }>;
}

export interface EDLClip {
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
  effects: EDLEffect[];
  transitions: EDLTransition[];
  speedCurve: EDLSpeedCurve | null;
  preservePitch: boolean;
}

export interface EDLTrack {
  id: string;
  name: string;
  kind: TrackKind;
  order: number;
  opacity: number;
  volume: number;
  locked: boolean;
  muted: boolean;
  solo: boolean;
  visible: boolean;
  allowOverlap: boolean;
  effects: EDLEffect[];
  clips: EDLClip[];
}

export interface EDLMediaAsset {
  id: string;
  name: string;
  type: "video" | "audio" | "image";
  duration: number;
  width: number;
  height: number;
  fps: number;
  url: string;
  sampleRate?: number;
  thumbnailCount?: number;
}

export interface EDLSequence {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  duration: number;
  tracks: EDLTrack[];
}

export interface EDLProjectSettings {
  snap: boolean;
  snapThreshold: number;
  activeSequenceId: string;
}

export interface EDLProject {
  version: string;
  exportedAt: number;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  sequences: EDLSequence[];
  mediaAssets: Record<string, EDLMediaAsset>;
  settings: EDLProjectSettings;
}

// ============================================================================
// Effect to FFmpeg Filter Mapping
// ============================================================================

/**
 * Maps effect types to FFmpeg filter string generators.
 *
 * Each function takes the effect parameters and returns the corresponding
 * FFmpeg filter string. Returns null for effects that cannot be mapped
 * (e.g., custom WebGL shaders).
 *
 * FFmpeg filter documentation: https://ffmpeg.org/ffmpeg-filters.html
 */
export const effectToFFmpeg: Record<
  EffectType,
  (params: Record<string, number | string>) => string | null
> = {
  // Basic adjustments using eq filter
  brightness: (p) => {
    const value = Number(p.value ?? 0);
    // FFmpeg eq brightness is -1 to 1, but we might use 0-2 scale
    return `eq=brightness=${value.toFixed(3)}`;
  },

  contrast: (p) => {
    const value = Number(p.value ?? 1);
    // FFmpeg eq contrast is 0.1 to 10, we use 0-2 scale
    return `eq=contrast=${value.toFixed(3)}`;
  },

  saturation: (p) => {
    const value = Number(p.value ?? 1);
    // FFmpeg eq saturation is 0 to 3
    return `eq=saturation=${value.toFixed(3)}`;
  },

  hue: (p) => {
    const value = Number(p.value ?? 0);
    // FFmpeg hue filter expects degrees
    return `hue=h=${value.toFixed(1)}`;
  },

  // Blur effects
  blur: (p) => {
    const radius = Number(p.radius ?? p.value ?? 5);
    // gblur sigma controls blur intensity
    return `gblur=sigma=${radius.toFixed(2)}`;
  },

  sharpen: (p) => {
    const amount = Number(p.amount ?? p.value ?? 1);
    // unsharp mask: lx:ly:la for luma sharpening
    // Higher amounts = stronger sharpening
    const strength = amount * 1.5;
    return `unsharp=5:5:${strength.toFixed(2)}:5:5:0`;
  },

  // Film effects
  grain: (p) => {
    const intensity = Number(p.intensity ?? 0.5);
    const size = Number(p.size ?? 3);
    // noise filter: alls=intensity (0-100), allf=t for temporal
    const noiseAmount = Math.round(intensity * 30);
    return `noise=alls=${noiseAmount}:allf=t`;
  },

  // Color grading (complex multi-param filter)
  colorGrade: (p) => {
    const temp = Number(p.temperature ?? 0);
    const tint = Number(p.tint ?? 0);
    const shadows = Number(p.shadows ?? 0);
    const highlights = Number(p.highlights ?? 0);
    const sat = Number(p.saturation ?? 1);
    const cont = Number(p.contrast ?? 1);

    // Use colorbalance for temperature/tint, eq for sat/contrast
    // colorbalance: rs, gs, bs for shadows; rm, gm, bm for mids; rh, gh, bh for highlights
    const warmCool = temp * 0.5;
    const greenMagenta = tint * 0.3;

    const filters: string[] = [];

    // Temperature/tint via colorbalance
    if (temp !== 0 || tint !== 0) {
      filters.push(
        `colorbalance=rs=${(-warmCool).toFixed(2)}:bs=${warmCool.toFixed(2)}:gs=${greenMagenta.toFixed(2)}`
      );
    }

    // Shadows/highlights via curves
    if (shadows !== 0 || highlights !== 0) {
      const shadowsAdj = 0.5 + shadows * 0.3;
      const highlightsAdj = 0.5 + highlights * 0.3;
      filters.push(
        `curves=m='0/0 ${shadowsAdj.toFixed(2)}/${shadowsAdj.toFixed(2)} 1/${highlightsAdj.toFixed(2)}'`
      );
    }

    // Saturation and contrast via eq
    if (sat !== 1 || cont !== 1) {
      filters.push(`eq=saturation=${sat.toFixed(2)}:contrast=${cont.toFixed(2)}`);
    }

    return filters.length > 0 ? filters.join(",") : null;
  },

  temperature: (p) => {
    const value = Number(p.value ?? 0);
    // Warm = add red/yellow, cool = add blue
    // Using colorbalance: negative = less, positive = more
    const warmCool = value * 0.5;
    return `colorbalance=rs=${(-warmCool).toFixed(2)}:bs=${warmCool.toFixed(2)}`;
  },

  tint: (p) => {
    const value = Number(p.value ?? 0);
    // Green/magenta shift
    return `colorbalance=gs=${(value * 0.3).toFixed(2)}`;
  },

  // Preset looks
  vintage: (p) => {
    const fade = Number(p.fade ?? 0.3);
    const sepia = Number(p.sepia ?? 0.5);
    const vignette = Number(p.vignette ?? 0.5);
    const grain = Number(p.grain ?? 0.3);

    const filters: string[] = [];

    // Sepia tone using colorchannelmixer
    if (sepia > 0) {
      const sepiaStrength = sepia * 0.7;
      filters.push(
        `colorchannelmixer=` +
          `rr=${(1 - sepiaStrength * 0.6).toFixed(2)}:rg=${(sepiaStrength * 0.4).toFixed(2)}:rb=${(sepiaStrength * 0.2).toFixed(2)}:` +
          `gr=${(sepiaStrength * 0.3).toFixed(2)}:gg=${(1 - sepiaStrength * 0.3).toFixed(2)}:gb=${(sepiaStrength * 0.1).toFixed(2)}:` +
          `br=${(sepiaStrength * 0.1).toFixed(2)}:bg=${(sepiaStrength * 0.2).toFixed(2)}:bb=${(1 - sepiaStrength * 0.5).toFixed(2)}`
      );
    }

    // Fade/wash effect
    if (fade > 0) {
      const fadeAmount = fade * 0.3;
      filters.push(`curves=m='0/${fadeAmount.toFixed(2)} 1/1'`);
    }

    // Vignette
    if (vignette > 0) {
      filters.push(`vignette=a=${(vignette * 0.5).toFixed(2)}`);
    }

    // Film grain
    if (grain > 0) {
      const noiseAmount = Math.round(grain * 20);
      filters.push(`noise=alls=${noiseAmount}:allf=t`);
    }

    return filters.length > 0 ? filters.join(",") : null;
  },

  bw: (p) => {
    // Black & white using hue saturation=0
    return `hue=s=0`;
  },

  sepia: (p) => {
    const intensity = Number(p.intensity ?? 0.8);
    // Sepia using colorchannelmixer
    const s = intensity * 0.7;
    return (
      `colorchannelmixer=` +
      `rr=${(1 - s * 0.6).toFixed(2)}:rg=${(s * 0.4).toFixed(2)}:rb=${(s * 0.2).toFixed(2)}:` +
      `gr=${(s * 0.3).toFixed(2)}:gg=${(1 - s * 0.3).toFixed(2)}:gb=${(s * 0.1).toFixed(2)}:` +
      `br=${(s * 0.1).toFixed(2)}:bg=${(s * 0.2).toFixed(2)}:bb=${(1 - s * 0.5).toFixed(2)}`
    );
  },

  crossProcess: (p) => {
    // Cross-process look: boost shadows in blue, highlights in yellow/green
    return `curves=r='0/0.1 0.5/0.5 1/0.9':g='0/0 0.5/0.6 1/1':b='0/0.2 0.5/0.4 1/0.8'`;
  },

  vignette: (p) => {
    const intensity = Number(p.intensity ?? 0.5);
    const radius = Number(p.radius ?? 0.5);
    // FFmpeg vignette: a=angle (controls size), f=factor (controls softness)
    // Smaller angle = larger vignette
    const angle = (1 - radius) * 0.5;
    return `vignette=a=${angle.toFixed(2)}:f=${intensity.toFixed(2)}`;
  },

  filmLook: (p) => {
    const grain = Number(p.grain ?? 0.3);
    const halation = Number(p.halation ?? 0.2);
    const contrast = Number(p.contrast ?? 1.2);
    const colorShift = Number(p.colorShift ?? 0);

    const filters: string[] = [];

    // Contrast
    if (contrast !== 1) {
      filters.push(`eq=contrast=${contrast.toFixed(2)}`);
    }

    // Halation (light bloom) - use gblur on highlights then blend
    // Simplified: just add slight bloom effect
    if (halation > 0) {
      // This is a simplified version; full halation needs complex filter graph
      filters.push(`unsharp=3:3:${(-halation * 2).toFixed(2)}:3:3:0`);
    }

    // Color shift (temperature)
    if (colorShift !== 0) {
      const warmCool = colorShift * 0.3;
      filters.push(`colorbalance=rs=${(-warmCool).toFixed(2)}:bs=${warmCool.toFixed(2)}`);
    }

    // Film grain
    if (grain > 0) {
      const noiseAmount = Math.round(grain * 25);
      filters.push(`noise=alls=${noiseAmount}:allf=t`);
    }

    return filters.length > 0 ? filters.join(",") : null;
  },

  lut: (p) => {
    const lutFile = p.lutFile ?? p.url;
    if (!lutFile || typeof lutFile !== "string") {
      return null;
    }
    // lut3d filter for .cube files
    return `lut3d='${lutFile}'`;
  },

  custom: () => {
    // Custom WebGL shaders cannot be converted to FFmpeg
    return null;
  },
};

// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Serialize an Effect to EDL format with FFmpeg filter string.
 */
export function serializeEffect(effect: Effect): EDLEffect {
  const ffmpegMapper = effectToFFmpeg[effect.type];
  let ffmpegFilter: string | null = null;

  if (ffmpegMapper && effect.enabled) {
    try {
      ffmpegFilter = ffmpegMapper(effect.params);
    } catch {
      // If mapping fails, leave as null
      ffmpegFilter = null;
    }
  }

  return {
    id: effect.id,
    type: effect.type,
    params: { ...effect.params },
    enabled: effect.enabled,
    blend: effect.blend ?? 1.0,
    order: effect.order ?? 0,
    ffmpegFilter,
  };
}

/**
 * Serialize a TransitionSpec to EDL format.
 */
export function serializeTransition(transition: TransitionSpec): EDLTransition {
  return {
    id: transition.id,
    type: transition.type,
    duration: transition.duration,
    easing: transition.easing,
  };
}

/**
 * Serialize a SpeedCurve to EDL format.
 */
export function serializeSpeedCurve(speedCurve: SpeedCurve | null): EDLSpeedCurve | null {
  if (!speedCurve) {
    return null;
  }

  return {
    keyframes: speedCurve.keyframes.map((kf) => ({
      time: kf.time,
      speed: kf.speed,
    })),
  };
}

/**
 * Serialize a Clip to EDL format.
 */
export function serializeClip(clip: Clip): EDLClip {
  return {
    id: clip.id,
    mediaId: clip.mediaId,
    trackId: clip.trackId,
    kind: clip.kind,
    start: clip.start,
    duration: clip.duration,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    opacity: clip.opacity,
    volume: clip.volume,
    effects: clip.effects.map(serializeEffect),
    transitions: clip.transitions.map(serializeTransition),
    speedCurve: serializeSpeedCurve(clip.speedCurve),
    preservePitch: clip.preservePitch,
  };
}

/**
 * Serialize a Track to EDL format.
 */
export function serializeTrack(track: Track): EDLTrack {
  return {
    id: track.id,
    name: track.name,
    kind: track.kind,
    order: track.order,
    opacity: track.opacity,
    volume: track.volume,
    locked: track.locked,
    muted: track.muted,
    solo: track.solo,
    visible: track.visible,
    allowOverlap: track.allowOverlap,
    effects: track.effects.map(serializeEffect),
    clips: track.clips.map(serializeClip),
  };
}

/**
 * Serialize a MediaAssetMeta to EDL format.
 * Excludes binary data like waveforms and thumbnails.
 */
export function serializeMediaAsset(asset: MediaAssetMeta): EDLMediaAsset {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    fps: asset.fps,
    url: asset.url,
    sampleRate: asset.sampleRate,
    thumbnailCount: asset.thumbnailCount,
  };
}

/**
 * Serialize a Sequence to EDL format.
 */
export function serializeSequence(sequence: Sequence): EDLSequence {
  return {
    id: sequence.id,
    name: sequence.name,
    width: sequence.width,
    height: sequence.height,
    fps: sequence.fps,
    sampleRate: sequence.sampleRate,
    duration: sequence.duration,
    tracks: sequence.tracks.map(serializeTrack),
  };
}

/**
 * Serialize a Project to EDL format.
 */
export function serializeProject(project: Project): EDLProject {
  const mediaAssets: Record<string, EDLMediaAsset> = {};
  for (const [id, asset] of Object.entries(project.mediaAssets)) {
    mediaAssets[id] = serializeMediaAsset(asset);
  }

  return {
    version: EDL_VERSION,
    exportedAt: Date.now(),
    id: project.id,
    title: project.title,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sequences: project.sequences.map(serializeSequence),
    mediaAssets,
    settings: {
      snap: project.settings.snap,
      snapThreshold: project.settings.snapThreshold,
      activeSequenceId: project.settings.activeSequenceId,
    },
  };
}

/**
 * Export project to EDL JSON string.
 */
export function exportToEDL(project: Project): string {
  const edlProject = serializeProject(project);
  return JSON.stringify(edlProject, null, 2);
}

/**
 * Export project to EDL and trigger download.
 */
export function downloadEDL(project: Project, filename?: string): void {
  const edlJson = exportToEDL(project);
  const blob = new Blob([edlJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? `${project.title || "project"}-edl.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// ============================================================================
// Validation and Utilities
// ============================================================================

/**
 * Validate that an EDL JSON conforms to the expected schema.
 * Returns validation errors if any.
 */
export function validateEDL(edl: unknown): string[] {
  const errors: string[] = [];

  if (!edl || typeof edl !== "object") {
    return ["EDL must be an object"];
  }

  const edlObj = edl as Record<string, unknown>;

  // Check version
  if (!edlObj.version || typeof edlObj.version !== "string") {
    errors.push("Missing or invalid version field");
  }

  // Check required top-level fields
  const requiredFields = ["id", "title", "sequences", "mediaAssets", "settings"];
  for (const field of requiredFields) {
    if (!(field in edlObj)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate sequences
  if (Array.isArray(edlObj.sequences)) {
    for (let i = 0; i < edlObj.sequences.length; i++) {
      const seq = edlObj.sequences[i] as Record<string, unknown>;
      if (!seq.id) errors.push(`Sequence ${i}: missing id`);
      if (typeof seq.fps !== "number") errors.push(`Sequence ${i}: missing or invalid fps`);
      if (!Array.isArray(seq.tracks)) errors.push(`Sequence ${i}: missing or invalid tracks`);
    }
  }

  // Validate mediaAssets
  if (edlObj.mediaAssets && typeof edlObj.mediaAssets === "object") {
    for (const [id, asset] of Object.entries(edlObj.mediaAssets)) {
      const assetObj = asset as Record<string, unknown>;
      if (!assetObj.url) errors.push(`Media asset ${id}: missing url`);
      if (!assetObj.type) errors.push(`Media asset ${id}: missing type`);
    }
  }

  return errors;
}

/**
 * Get combined FFmpeg filter string for a list of effects.
 * Respects effect order and enabled state.
 */
export function getCombinedFFmpegFilters(effects: EDLEffect[]): string | null {
  const enabledEffects = effects
    .filter((e) => e.enabled && e.ffmpegFilter)
    .sort((a, b) => a.order - b.order);

  if (enabledEffects.length === 0) {
    return null;
  }

  return enabledEffects.map((e) => e.ffmpegFilter).join(",");
}

/**
 * Parse EDL version to compare compatibility.
 */
export function parseEDLVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split(".").map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Check if an EDL version is compatible with the current version.
 * Currently requires same major version.
 */
export function isEDLVersionCompatible(version: string): boolean {
  const current = parseEDLVersion(EDL_VERSION);
  const target = parseEDLVersion(version);
  return current.major === target.major;
}
