/**
 * Effects Module
 *
 * Centralized effect application for video clips.
 * Handles all visual effects (grain, color grading, vintage, vignette, film look)
 */

import type { Effect, Clip } from "../types";
import { applyGrainEffect } from "./grain-filter";
import { applyColorGradeEffect } from "./color-grading";
import { applyVintage, applyVignette } from "./artistic-filters";

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
  switch (effect.type) {
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

    case "brightness":
    case "contrast":
    case "saturation":
    case "blur":
      // Basic effects - could be implemented with CSS filters or pixel manipulation
      console.warn(`[Effects] ${effect.type} not yet implemented`);
      break;

    default:
      console.warn(`[Effects] Unknown effect type: ${effect.type}`);
  }
}

export { applyGrainEffect } from "./grain-filter";
export { applyColorGradeEffect } from "./color-grading";
export { applyVintage, applyVignette, applyVignettePixelBased } from "./artistic-filters";
