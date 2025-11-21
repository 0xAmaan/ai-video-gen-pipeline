/**
 * Filter Presets Library
 *
 * This module defines preset filter configurations for video clips.
 * Each preset includes metadata and default parameters for visual effects.
 */

import type { EffectType, Effect } from "../types";

export interface FilterPreset {
  id: string;
  name: string;
  type: EffectType;
  description: string;
  params: Record<string, number>;
  thumbnailIcon: string; // Lucide icon name
  category: "filmGrain" | "colorGrading" | "vintage" | "vignette" | "filmLook";
}

/**
 * Predefined filter presets
 */
export const FILTER_PRESETS: FilterPreset[] = [
  // FILM GRAIN PRESETS
  {
    id: "grain-subtle",
    name: "Subtle Grain",
    type: "grain",
    description: "Light film grain for a classic look",
    params: { intensity: 0.15, size: 1.5 },
    thumbnailIcon: "Sparkles",
    category: "filmGrain",
  },
  {
    id: "grain-medium",
    name: "Medium Grain",
    type: "grain",
    description: "Moderate grain for 16mm film aesthetic",
    params: { intensity: 0.35, size: 2 },
    thumbnailIcon: "Sparkles",
    category: "filmGrain",
  },
  {
    id: "grain-heavy",
    name: "Heavy Grain",
    type: "grain",
    description: "Strong grain for vintage film look",
    params: { intensity: 0.6, size: 3 },
    thumbnailIcon: "Sparkles",
    category: "filmGrain",
  },

  // COLOR GRADING PRESETS
  {
    id: "grade-warm",
    name: "Warm",
    type: "colorGrade",
    description: "Warm sunset tones",
    params: {
      temperature: 0.3,
      tint: 0.1,
      shadows: 0.1,
      highlights: 0.05,
      saturation: 1.1,
      contrast: 1.05,
    },
    thumbnailIcon: "Sunset",
    category: "colorGrading",
  },
  {
    id: "grade-cool",
    name: "Cool",
    type: "colorGrade",
    description: "Cool blue tones",
    params: {
      temperature: -0.3,
      tint: -0.1,
      shadows: -0.05,
      highlights: 0.1,
      saturation: 1.05,
      contrast: 1.1,
    },
    thumbnailIcon: "Snowflake",
    category: "colorGrading",
  },
  {
    id: "grade-cinematic",
    name: "Cinematic",
    type: "colorGrade",
    description: "Hollywood blockbuster look",
    params: {
      temperature: 0.1,
      tint: -0.05,
      shadows: -0.2,
      highlights: 0.1,
      saturation: 1.15,
      contrast: 1.25,
    },
    thumbnailIcon: "Film",
    category: "colorGrading",
  },
  {
    id: "grade-desaturated",
    name: "Desaturated",
    type: "colorGrade",
    description: "Muted, washed-out colors",
    params: {
      temperature: 0,
      tint: 0,
      shadows: 0.1,
      highlights: 0.1,
      saturation: 0.6,
      contrast: 0.9,
    },
    thumbnailIcon: "Droplet",
    category: "colorGrading",
  },

  // VINTAGE PRESETS
  {
    id: "vintage-60s",
    name: "60s Film",
    type: "vintage",
    description: "1960s home video aesthetic",
    params: { fade: 0.3, sepia: 0.2, vignette: 0.3, grain: 0.4 },
    thumbnailIcon: "Camera",
    category: "vintage",
  },
  {
    id: "vintage-70s",
    name: "70s Film",
    type: "vintage",
    description: "1970s warm film look",
    params: { fade: 0.25, sepia: 0.35, vignette: 0.25, grain: 0.35 },
    thumbnailIcon: "Camera",
    category: "vintage",
  },
  {
    id: "vintage-80s",
    name: "80s Film",
    type: "vintage",
    description: "1980s VHS tape aesthetic",
    params: { fade: 0.2, sepia: 0.15, vignette: 0.2, grain: 0.5 },
    thumbnailIcon: "Camera",
    category: "vintage",
  },

  // VIGNETTE PRESETS
  {
    id: "vignette-soft",
    name: "Soft Vignette",
    type: "vignette",
    description: "Subtle edge darkening",
    params: { intensity: 0.3, radius: 0.7, softness: 0.8 },
    thumbnailIcon: "Circle",
    category: "vignette",
  },
  {
    id: "vignette-hard",
    name: "Hard Vignette",
    type: "vignette",
    description: "Strong focused spotlight effect",
    params: { intensity: 0.6, radius: 0.5, softness: 0.3 },
    thumbnailIcon: "CircleDot",
    category: "vignette",
  },

  // FILM LOOK PRESETS
  {
    id: "film-kodak",
    name: "Kodak Vision3",
    type: "filmLook",
    description: "Kodak film stock emulation",
    params: { grain: 0.25, halation: 0.3, contrast: 1.15, colorShift: 0.1 },
    thumbnailIcon: "Film",
    category: "filmLook",
  },
  {
    id: "film-fuji",
    name: "Fujifilm",
    type: "filmLook",
    description: "Fuji film stock with vibrant colors",
    params: { grain: 0.2, halation: 0.25, contrast: 1.2, colorShift: -0.05 },
    thumbnailIcon: "Film",
    category: "filmLook",
  },
  {
    id: "film-arri",
    name: "ARRI Alexa",
    type: "filmLook",
    description: "Digital cinema camera look",
    params: { grain: 0.1, halation: 0.15, contrast: 1.1, colorShift: 0 },
    thumbnailIcon: "Video",
    category: "filmLook",
  },
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): FilterPreset | undefined {
  return FILTER_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(
  category: FilterPreset["category"],
): FilterPreset[] {
  return FILTER_PRESETS.filter((preset) => preset.category === category);
}

/**
 * Create an Effect from a filter preset
 */
export function createEffectFromPreset(
  presetId: string,
  options?: {
    params?: Record<string, number>;
    enabled?: boolean;
  },
): Effect {
  const preset = getPresetById(presetId);
  if (!preset) {
    throw new Error(`Filter preset not found: ${presetId}`);
  }

  return {
    id: `effect-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
    type: preset.type,
    params: { ...preset.params, ...options?.params },
    enabled: options?.enabled ?? true,
  };
}
