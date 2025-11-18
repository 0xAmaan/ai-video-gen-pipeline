/**
 * Color Effects
 *
 * Additional color manipulation effects: black & white, sepia, cross-process,
 * temperature, tint, and LUT (lookup table) application.
 */

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
 * Apply black & white effect (desaturate)
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyBlackAndWhite(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const intensity = clamp((params.intensity as number) ?? 1.0, 0, 1);

  if (intensity < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const effectAmount = intensity * blend;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Use luminance formula for better perceptual grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Blend between original and grayscale
      data[i] = r + (gray - r) * effectAmount;
      data[i + 1] = g + (gray - g) * effectAmount;
      data[i + 2] = b + (gray - b) * effectAmount;
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error('[ColorEffects] Failed to apply black & white:', error);
  }
}

/**
 * Apply sepia tone effect
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applySepia(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const intensity = clamp((params.intensity as number) ?? 1.0, 0, 1);

  if (intensity < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const effectAmount = intensity * blend;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Standard sepia transformation matrix
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;

      // Blend between original and sepia
      data[i] = clamp(r + (tr - r) * effectAmount, 0, 255);
      data[i + 1] = clamp(g + (tg - g) * effectAmount, 0, 255);
      data[i + 2] = clamp(b + (tb - b) * effectAmount, 0, 255);
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error('[ColorEffects] Failed to apply sepia:', error);
  }
}

/**
 * Apply cross-process effect (high contrast with color shifts)
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyCrossProcess(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const intensity = clamp((params.intensity as number) ?? 1.0, 0, 1);

  if (intensity < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const effectAmount = intensity * blend;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Convert to HSL for manipulation
      let [h, s, l] = rgbToHsl(r, g, b);

      // Increase saturation and shift hues
      s = clamp(s * (1 + 0.3 * effectAmount), 0, 1);
      
      // Shift hues for cross-process look (greens -> cyan, reds -> magenta)
      if (h >= 60 && h <= 180) {
        // Green to cyan shift
        h = h - 20 * effectAmount;
      } else if (h >= 0 && h <= 60 || h >= 300) {
        // Red to magenta shift
        h = h + 10 * effectAmount;
      }
      
      h = (h + 360) % 360;

      // Increase contrast in lightness
      l = clamp((l - 0.5) * (1 + 0.4 * effectAmount) + 0.5, 0, 1);

      // Convert back to RGB
      [r, g, b] = hslToRgb(h, s, l);

      data[i] = clamp(r, 0, 255);
      data[i + 1] = clamp(g, 0, 255);
      data[i + 2] = clamp(b, 0, 255);
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error('[ColorEffects] Failed to apply cross-process:', error);
  }
}

/**
 * Apply temperature adjustment (warm/cool)
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyTemperature(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const temperature = clamp((params.temperature as number) ?? 0, -1, 1);

  if (Math.abs(temperature) < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const adjustedTemp = temperature * blend;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Positive = warmer (increase red/yellow, decrease blue)
      // Negative = cooler (decrease red, increase blue)
      if (adjustedTemp > 0) {
        r = clamp(r + adjustedTemp * 30, 0, 255);
        b = clamp(b - adjustedTemp * 20, 0, 255);
      } else {
        r = clamp(r + adjustedTemp * 20, 0, 255);
        b = clamp(b - adjustedTemp * 30, 0, 255);
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error('[ColorEffects] Failed to apply temperature:', error);
  }
}

/**
 * Apply tint adjustment (magenta/green)
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyTint(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const tint = clamp((params.tint as number) ?? 0, -1, 1);

  if (Math.abs(tint) < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const adjustedTint = tint * blend;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Positive = magenta (increase red/blue, decrease green)
      // Negative = green (increase green, decrease red/blue)
      if (adjustedTint > 0) {
        r = clamp(r + adjustedTint * 20, 0, 255);
        g = clamp(g - adjustedTint * 20, 0, 255);
        b = clamp(b + adjustedTint * 20, 0, 255);
      } else {
        r = clamp(r + adjustedTint * 15, 0, 255);
        g = clamp(g - adjustedTint * 30, 0, 255);
        b = clamp(b + adjustedTint * 15, 0, 255);
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error('[ColorEffects] Failed to apply tint:', error);
  }
}

/**
 * Apply LUT (lookup table) from an image file
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters (must contain 'lutUrl' string)
 * @param blend - Blend amount (0-1)
 */
export function applyLUT(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  // LUT application requires loading an external image
  // For now, log a warning that this needs to be implemented with async loading
  console.warn('[ColorEffects] LUT effect requires async image loading - not yet implemented in synchronous effect pipeline');
  console.warn('[ColorEffects] LUT URL:', params.lutUrl);
  
  // TODO: Implement LUT loading and application
  // This will require:
  // 1. Load LUT image asynchronously
  // 2. Extract RGB lookup values from LUT texture
  // 3. Apply lookup transformation to each pixel
  // 4. Cache loaded LUTs for performance
}

/**
 * Export color space conversion utilities for reuse
 */
export { rgbToHsl, hslToRgb };
