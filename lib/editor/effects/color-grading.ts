/**
 * Color Grading Effect
 *
 * Professional color grading with temperature, tint, shadows, highlights,
 * saturation, and contrast controls using RGB/HSL color space transformations.
 */

import type { ColorGradeParams } from "../types";

/**
 * Convert RGB to HSL color space
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns [hue (0-360), saturation (0-1), lightness (0-1)]
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return [h * 360, s, l];
}

/**
 * Convert HSL to RGB color space
 * @param h - Hue (0-360)
 * @param s - Saturation (0-1)
 * @param l - Lightness (0-1)
 * @returns [red (0-255), green (0-255), blue (0-255)]
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  if (s === 0) {
    const gray = l * 255;
    return [gray, gray, gray];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return [r * 255, g * 255, b * 255];
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply color grading effect to a canvas context
 *
 * @param ctx - Canvas 2D context to apply color grading to
 * @param params - Color grading parameters
 */
export function applyColorGradeEffect(
  ctx: CanvasRenderingContext2D,
  params: Partial<ColorGradeParams>,
): void {
  const temperature = clamp(params.temperature ?? 0, -1, 1);
  const tint = clamp(params.tint ?? 0, -1, 1);
  const shadows = clamp(params.shadows ?? 0, -1, 1);
  const highlights = clamp(params.highlights ?? 0, -1, 1);
  const saturation = Math.max(0, params.saturation ?? 1);
  const contrast = Math.max(0, params.contrast ?? 1);

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Early exit for invalid canvas
  if (width === 0 || height === 0) return;

  // Early exit if all adjustments are at defaults
  if (
    Math.abs(temperature) < 0.01 &&
    Math.abs(tint) < 0.01 &&
    Math.abs(shadows) < 0.01 &&
    Math.abs(highlights) < 0.01 &&
    Math.abs(saturation - 1) < 0.01 &&
    Math.abs(contrast - 1) < 0.01
  ) {
    return;
  }

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Convert to HSL for some operations
      let [h, s, l] = rgbToHsl(r, g, b);

      // Apply temperature (shift hue towards warm/cool)
      if (Math.abs(temperature) > 0.01) {
        // Temperature: positive = warmer (shift towards yellow/orange)
        // negative = cooler (shift towards blue)
        const tempShift = temperature * 30; // ±30 degrees
        h = (h + tempShift + 360) % 360;
      }

      // Apply tint (shift hue towards magenta/green)
      if (Math.abs(tint) > 0.01) {
        // Tint: positive = magenta, negative = green
        const tintShift = tint * 20; // ±20 degrees, offset from temperature
        h = (h + tintShift + 360) % 360;
      }

      // Apply saturation adjustment
      if (Math.abs(saturation - 1) > 0.01) {
        s = clamp(s * saturation, 0, 1);
      }

      // Convert back to RGB after hue/saturation adjustments
      [r, g, b] = hslToRgb(h, s, l);

      // Apply shadows/highlights with luminance-based masking
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const normalizedLum = luminance / 255;

      // Shadows affect darker pixels (luminance < 0.3)
      if (Math.abs(shadows) > 0.01) {
        const shadowMask = Math.max(0, 1 - normalizedLum / 0.3);
        const shadowAdjust = shadows * 50 * shadowMask;
        r = clamp(r + shadowAdjust, 0, 255);
        g = clamp(g + shadowAdjust, 0, 255);
        b = clamp(b + shadowAdjust, 0, 255);
      }

      // Highlights affect brighter pixels (luminance > 0.7)
      if (Math.abs(highlights) > 0.01) {
        const highlightMask = Math.max(0, (normalizedLum - 0.7) / 0.3);
        const highlightAdjust = highlights * 50 * highlightMask;
        r = clamp(r + highlightAdjust, 0, 255);
        g = clamp(g + highlightAdjust, 0, 255);
        b = clamp(b + highlightAdjust, 0, 255);
      }

      // Apply contrast adjustment
      if (Math.abs(contrast - 1) > 0.01) {
        const contrastFactor = contrast;
        r = clamp(((r / 255 - 0.5) * contrastFactor + 0.5) * 255, 0, 255);
        g = clamp(((g / 255 - 0.5) * contrastFactor + 0.5) * 255, 0, 255);
        b = clamp(((b / 255 - 0.5) * contrastFactor + 0.5) * 255, 0, 255);
      }

      // Write adjusted values back
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      // data[i + 3] is alpha - leave unchanged
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error("[ColorGrading] Failed to apply color grading:", error);
  }
}
