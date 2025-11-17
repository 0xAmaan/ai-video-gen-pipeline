/**
 * Artistic Filter Effects
 *
 * Vintage film simulation and vignette effects using composite pixel manipulation,
 * radial gradients, and optimized Canvas operations.
 */

import type { VintageParams, VignetteParams } from "../types";

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply vintage film effect to a canvas context
 *
 * Combines multiple operations:
 * - Reduces saturation by 30%
 * - Adds warm tint (+15 red, -10 blue)
 * - Adds subtle grain
 * - Lifts blacks (increases minimum luminance)
 * - Adds soft vignette
 *
 * @param ctx - Canvas 2D context to apply vintage effect to
 * @param params - Vintage parameters (fade, sepia, vignette, grain)
 */
export function applyVintage(
  ctx: CanvasRenderingContext2D,
  params: Partial<VintageParams>,
): void {
  const fade = clamp(params.fade ?? 0.3, 0, 1);
  const sepia = clamp(params.sepia ?? 0.5, 0, 1);
  const vignetteIntensity = clamp(params.vignette ?? 0.4, 0, 1);
  const grainAmount = clamp(params.grain ?? 0.2, 0, 1);

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Early exit for invalid canvas
  if (width === 0 || height === 0) return;

  // Early exit if all effects are at minimum
  if (fade < 0.01 && sepia < 0.01 && vignetteIntensity < 0.01 && grainAmount < 0.01) {
    return;
  }

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Center point for vignette
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        let r = data[index];
        let g = data[index + 1];
        let b = data[index + 2];

        // Apply sepia tone if enabled
        if (sepia > 0.01) {
          const tr = 0.393 * r + 0.769 * g + 0.189 * b;
          const tg = 0.349 * r + 0.686 * g + 0.168 * b;
          const tb = 0.272 * r + 0.534 * g + 0.131 * b;

          // Blend with original based on sepia intensity
          r = r * (1 - sepia) + tr * sepia;
          g = g * (1 - sepia) + tg * sepia;
          b = b * (1 - sepia) + tb * sepia;
        }

        // Reduce saturation by 30% (convert to grayscale and blend)
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const saturationReduction = 0.3;
        r = r * (1 - saturationReduction) + gray * saturationReduction;
        g = g * (1 - saturationReduction) + gray * saturationReduction;
        b = b * (1 - saturationReduction) + gray * saturationReduction;

        // Add warm tint (+15 red, -10 blue)
        r = clamp(r + 15, 0, 255);
        b = clamp(b - 10, 0, 255);

        // Lift blacks (increase minimum luminance)
        // This prevents pure blacks, giving a washed/faded film look
        const blackLift = 25 * fade;
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance < 50) {
          const liftFactor = (50 - luminance) / 50;
          r = clamp(r + blackLift * liftFactor, 0, 255);
          g = clamp(g + blackLift * liftFactor, 0, 255);
          b = clamp(b + blackLift * liftFactor, 0, 255);
        }

        // Apply subtle vignette
        if (vignetteIntensity > 0.01) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const normalizedDistance = distance / maxDistance;

          // Soft falloff curve for vignette
          const vignetteFactor = 1 - Math.pow(normalizedDistance, 2) * vignetteIntensity;
          r = clamp(r * vignetteFactor, 0, 255);
          g = clamp(g * vignetteFactor, 0, 255);
          b = clamp(b * vignetteFactor, 0, 255);
        }

        // Add subtle grain
        if (grainAmount > 0.01) {
          const grainStrength = grainAmount * 20;
          const noise = (Math.random() * 2 - 1) * grainStrength;
          r = clamp(r + noise, 0, 255);
          g = clamp(g + noise, 0, 255);
          b = clamp(b + noise, 0, 255);
        }

        // Write adjusted values back
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        // data[index + 3] is alpha - leave unchanged
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error("[ArtisticFilters] Failed to apply vintage effect:", error);
  }
}

/**
 * Apply vignette effect to a canvas context
 *
 * Uses optimized radial gradient with Canvas compositing instead of per-pixel manipulation
 * for better performance. Creates a darkening effect from the edges towards the center.
 *
 * @param ctx - Canvas 2D context to apply vignette to
 * @param params - Vignette parameters (intensity, radius, softness)
 */
export function applyVignette(
  ctx: CanvasRenderingContext2D,
  params: Partial<VignetteParams>,
): void {
  const intensity = clamp(params.intensity ?? 0.5, 0, 1);
  const radius = clamp(params.radius ?? 0.5, 0, 1);
  const softness = clamp(params.softness ?? 0.5, 0, 1);

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Early exit for invalid canvas or no effect
  if (width === 0 || height === 0 || intensity < 0.01) {
    return;
  }

  try {
    // Calculate center and radius for radial gradient
    const centerX = width / 2;
    const centerY = height / 2;

    // Maximum distance from center to corners
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    // Inner radius (where vignette starts) based on radius parameter
    // radius=0 means small clear area, radius=1 means large clear area
    const innerRadius = maxDistance * radius;

    // Outer radius (where vignette reaches full darkness)
    // Controlled by softness parameter (higher softness = more gradual falloff)
    const outerRadius = maxDistance * (radius + (1 - radius) * (1 - softness * 0.5));

    // Create radial gradient
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      innerRadius,
      centerX,
      centerY,
      outerRadius,
    );

    // Transparent at center, black at edges
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

    // Save current state
    ctx.save();

    // Use multiply blend mode to darken the image
    ctx.globalCompositeOperation = "multiply";

    // Fill with gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Restore original state
    ctx.restore();
  } catch (error) {
    console.error("[ArtisticFilters] Failed to apply vignette effect:", error);
  }
}

/**
 * Apply vignette using per-pixel manipulation (alternative implementation)
 *
 * This is slower than the gradient-based approach but provides more control
 * over the darkening curve. Use this if you need custom falloff curves.
 *
 * @param ctx - Canvas 2D context to apply vignette to
 * @param params - Vignette parameters (intensity, radius, softness)
 */
export function applyVignettePixelBased(
  ctx: CanvasRenderingContext2D,
  params: Partial<VignetteParams>,
): void {
  const intensity = clamp(params.intensity ?? 0.5, 0, 1);
  const radiusParam = clamp(params.radius ?? 0.5, 0, 1);
  const softness = clamp(params.softness ?? 0.5, 0, 1);

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Early exit for invalid canvas or no effect
  if (width === 0 || height === 0 || intensity < 0.01) {
    return;
  }

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Calculate distance from center
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const normalizedDistance = distance / maxDistance;

        // Apply darkening curve based on distance and parameters
        // radius controls where darkening starts
        // softness controls falloff curve
        const darkenStart = radiusParam;
        const darkenEnd = 1.0;

        let vignetteFactor = 1.0;

        if (normalizedDistance > darkenStart) {
          const darkenProgress =
            (normalizedDistance - darkenStart) / (darkenEnd - darkenStart);

          // Apply softness to the falloff curve
          const curve = Math.pow(darkenProgress, 2 - softness);

          vignetteFactor = 1 - curve * intensity;
        }

        // Apply vignette to RGB channels
        data[index] = clamp(data[index] * vignetteFactor, 0, 255); // R
        data[index + 1] = clamp(data[index + 1] * vignetteFactor, 0, 255); // G
        data[index + 2] = clamp(data[index + 2] * vignetteFactor, 0, 255); // B
        // data[index + 3] is alpha - leave unchanged
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error("[ArtisticFilters] Failed to apply pixel-based vignette:", error);
  }
}
