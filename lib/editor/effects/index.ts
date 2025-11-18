/**
 * Effects Module
 *
 * Centralized effect application for video clips and tracks.
 * Handles all visual effects including basic filters, color grading, artistic filters,
 * and color effects with blend parameter support.
 */

import type { Effect, Clip } from "../types";
import { applyGrainEffect } from "./grain-filter";
import { applyColorGradeEffect } from "./color-grading";
import { applyVintage, applyVignette } from "./artistic-filters";
import {
  applyBrightness,
  applyContrast,
  applySaturation,
  applyBlur,
  applyHue,
  applySharpen,
} from "./basic-filters";
import {
  applyBlackAndWhite,
  applySepia,
  applyCrossProcess,
  applyTemperature,
  applyTint,
  applyLUT,
} from "./color-effects";

/**
 * Apply all enabled effects from a clip to a canvas context
 *
 * @param ctx - Canvas 2D context to apply effects to
 * @param clip - Clip containing effects to apply
 * @param frameNumber - Optional frame number for temporal consistency
 */
export function applyClipEffects(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  frameNumber?: number,
): void {
  if (!clip.effects || clip.effects.length === 0) {
    return;
  }

  // Apply each enabled effect in order
  for (const effect of clip.effects) {
    if (!effect.enabled) continue;

    try {
      applyEffect(ctx, effect, frameNumber);
    } catch (error) {
      console.error(`[Effects] Failed to apply ${effect.type} effect:`, error);
    }
  }
}

/**
 * Apply a single effect to a canvas context
 *
 * @param ctx - Canvas 2D context
 * @param effect - Effect to apply
 * @param frameNumber - Optional frame number for temporal consistency
 */
export function applyEffect(
  ctx: CanvasRenderingContext2D,
  effect: Effect,
  frameNumber?: number,
): void {
  // Get blend amount (default to 1.0 if not specified)
  const blend = effect.blend ?? 1.0;

  // Skip effect if blend is 0 or effect is disabled
  if (!effect.enabled || blend <= 0) {
    return;
  }

  switch (effect.type) {
    // Basic filter effects
    case "brightness":
      applyBrightness(ctx, effect.params, blend);
      break;

    case "contrast":
      applyContrast(ctx, effect.params, blend);
      break;

    case "saturation":
      applySaturation(ctx, effect.params, blend);
      break;

    case "blur":
      applyBlur(ctx, effect.params, blend);
      break;

    case "hue":
      applyHue(ctx, effect.params, blend);
      break;

    case "sharpen":
      applySharpen(ctx, effect.params, blend);
      break;

    // Color effects
    case "bw":
      applyBlackAndWhite(ctx, effect.params, blend);
      break;

    case "sepia":
      applySepia(ctx, effect.params, blend);
      break;

    case "crossProcess":
      applyCrossProcess(ctx, effect.params, blend);
      break;

    case "temperature":
      applyTemperature(ctx, effect.params, blend);
      break;

    case "tint":
      applyTint(ctx, effect.params, blend);
      break;

    case "lut":
      applyLUT(ctx, effect.params, blend);
      break;

    // Existing effects (need blend parameter support added)
    case "grain":
      applyGrainEffect(ctx, effect.params, frameNumber);
      break;

    case "colorGrade":
      applyColorGradeEffect(ctx, effect.params);
      break;

    case "vintage":
      applyVintage(ctx, effect.params);
      break;

    case "vignette":
      applyVignette(ctx, effect.params);
      break;

    case "filmLook":
      // TODO: Implement film look
      console.warn("[Effects] Film look not yet implemented");
      break;

    case "custom":
      console.warn("[Effects] Custom effect type - no built-in implementation");
      break;

    default:
      console.warn(`[Effects] Unknown effect type: ${effect.type}`);
  }
}

// Re-export all effect functions for external use
export { applyGrainEffect } from "./grain-filter";
export { applyColorGradeEffect } from "./color-grading";
export { applyVintage, applyVignette, applyVignettePixelBased } from "./artistic-filters";
export {
  applyBrightness,
  applyContrast,
  applySaturation,
  applyBlur,
  applyHue,
  applySharpen,
} from "./basic-filters";
export {
  applyBlackAndWhite,
  applySepia,
  applyCrossProcess,
  applyTemperature,
  applyTint,
  applyLUT,
  rgbToHsl,
  hslToRgb,
} from "./color-effects";
