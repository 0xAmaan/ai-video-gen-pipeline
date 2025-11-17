/**
 * Transition Presets Library
 *
 * This module defines preset transition configurations for video clips.
 * Each preset includes metadata and rendering parameters for Canvas API implementation.
 */

export type TransitionType =
  | "fade"
  | "dissolve"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out";

export type EasingFunction =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";

export interface TransitionPreset {
  id: string;
  name: string;
  type: TransitionType;
  description: string;
  defaultDuration: number; // in seconds
  defaultEasing: EasingFunction;
  thumbnailIcon: string; // Lucide icon name or emoji
  category: "fade" | "wipe" | "slide" | "zoom";
}

/**
 * Easing function implementations
 * @param t - Progress value from 0 to 1
 * @returns Eased progress value
 */
export const easingFunctions: Record<EasingFunction, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => t * (2 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

/**
 * Predefined transition presets
 */
export const TRANSITION_PRESETS: TransitionPreset[] = [
  // FADE TRANSITIONS
  {
    id: "fade",
    name: "Fade",
    type: "fade",
    description: "Smoothly fade from one clip to another",
    defaultDuration: 0.5,
    defaultEasing: "ease-in-out",
    thumbnailIcon: "Circle",
    category: "fade",
  },
  {
    id: "dissolve",
    name: "Dissolve",
    type: "dissolve",
    description: "Cross-fade with slight blur effect",
    defaultDuration: 0.75,
    defaultEasing: "ease-in-out",
    thumbnailIcon: "Droplets",
    category: "fade",
  },

  // WIPE TRANSITIONS
  {
    id: "wipe-left",
    name: "Wipe Left",
    type: "wipe-left",
    description: "New clip wipes in from the right",
    defaultDuration: 0.6,
    defaultEasing: "ease-out",
    thumbnailIcon: "ArrowLeft",
    category: "wipe",
  },
  {
    id: "wipe-right",
    name: "Wipe Right",
    type: "wipe-right",
    description: "New clip wipes in from the left",
    defaultDuration: 0.6,
    defaultEasing: "ease-out",
    thumbnailIcon: "ArrowRight",
    category: "wipe",
  },
  {
    id: "wipe-up",
    name: "Wipe Up",
    type: "wipe-up",
    description: "New clip wipes in from the bottom",
    defaultDuration: 0.6,
    defaultEasing: "ease-out",
    thumbnailIcon: "ArrowUp",
    category: "wipe",
  },
  {
    id: "wipe-down",
    name: "Wipe Down",
    type: "wipe-down",
    description: "New clip wipes in from the top",
    defaultDuration: 0.6,
    defaultEasing: "ease-out",
    thumbnailIcon: "ArrowDown",
    category: "wipe",
  },

  // SLIDE TRANSITIONS
  {
    id: "slide-left",
    name: "Slide Left",
    type: "slide-left",
    description: "Old clip slides out left, new clip slides in from right",
    defaultDuration: 0.8,
    defaultEasing: "ease-in-out",
    thumbnailIcon: "MoveLeft",
    category: "slide",
  },
  {
    id: "slide-right",
    name: "Slide Right",
    type: "slide-right",
    description: "Old clip slides out right, new clip slides in from left",
    defaultDuration: 0.8,
    defaultEasing: "ease-in-out",
    thumbnailIcon: "MoveRight",
    category: "slide",
  },
  {
    id: "slide-up",
    name: "Slide Up",
    type: "slide-up",
    description: "Old clip slides out up, new clip slides in from bottom",
    defaultDuration: 0.8,
    defaultEasing: "ease-in-out",
    thumbnailIcon: "MoveUp",
    category: "slide",
  },
  {
    id: "slide-down",
    name: "Slide Down",
    type: "slide-down",
    description: "Old clip slides out down, new clip slides in from top",
    defaultDuration: 0.8,
    defaultEasing: "ease-in-out",
    thumbnailIcon: "MoveDown",
    category: "slide",
  },

  // ZOOM TRANSITIONS
  {
    id: "zoom-in",
    name: "Zoom In",
    type: "zoom-in",
    description: "New clip zooms in from center",
    defaultDuration: 0.7,
    defaultEasing: "ease-out",
    thumbnailIcon: "ZoomIn",
    category: "zoom",
  },
  {
    id: "zoom-out",
    name: "Zoom Out",
    type: "zoom-out",
    description: "Old clip zooms out, revealing new clip",
    defaultDuration: 0.7,
    defaultEasing: "ease-in",
    thumbnailIcon: "ZoomOut",
    category: "zoom",
  },
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): TransitionPreset | undefined {
  return TRANSITION_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(
  category: TransitionPreset["category"],
): TransitionPreset[] {
  return TRANSITION_PRESETS.filter((preset) => preset.category === category);
}

/**
 * Get the easing function implementation from an easing name
 */
export function getEasingFunction(easing: EasingFunction): (t: number) => number {
  return easingFunctions[easing];
}

/**
 * Create a TransitionSpec from a preset
 */
export function createTransitionFromPreset(
  presetId: string,
  options?: {
    duration?: number;
    easing?: EasingFunction;
  },
) {
  const preset = getPresetById(presetId);
  if (!preset) {
    throw new Error(`Transition preset not found: ${presetId}`);
  }

  return {
    id: `transition-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
    type: preset.type,
    duration: options?.duration ?? preset.defaultDuration,
    easing: options?.easing ?? preset.defaultEasing, // Return string identifier instead of function
  };
}
