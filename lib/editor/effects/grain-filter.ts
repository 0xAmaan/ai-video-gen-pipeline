/**
 * Film Grain Effect
 *
 * Applies realistic film grain/noise to video frames using Canvas pixel manipulation.
 * Uses seedable pseudo-random noise for temporal consistency.
 */

import type { GrainParams } from "../types";

/**
 * Simple seedable PRNG for consistent grain patterns
 * Uses mulberry32 algorithm for fast, quality random numbers
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0; // Ensure unsigned 32-bit integer
  }

  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Apply film grain effect to a canvas context
 *
 * @param ctx - Canvas 2D context to apply grain to
 * @param params - Grain parameters (intensity: 0-1, size: 1-10)
 * @param seed - Optional seed for reproducible grain (use frame number for temporal consistency)
 */
export function applyGrainEffect(
  ctx: CanvasRenderingContext2D,
  params: Partial<GrainParams>,
  seed?: number,
): void {
  const intensity = Math.max(0, Math.min(1, params.intensity ?? 0.3));
  const grainSize = Math.max(1, Math.min(10, params.size ?? 2));

  // Early exit if intensity is too low to be visible
  if (intensity < 0.01) return;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Early exit for invalid canvas
  if (width === 0 || height === 0) return;

  try {
    // Get pixel data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Initialize seeded random if seed provided, otherwise use Math.random
    const rng = seed !== undefined ? new SeededRandom(seed) : null;
    const random = () => (rng ? rng.next() : Math.random());

    // Calculate grain strength (0-255 range)
    const grainStrength = intensity * 40; // Max ±40 for intensity=1

    // Apply grain with size parameter
    // Grain size controls how frequently we apply noise (larger = chunkier grain)
    const step = Math.max(1, Math.floor(grainSize / 2));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        // Generate noise value (-1 to 1)
        const noise = (random() * 2 - 1) * grainStrength;

        // Apply to a block of pixels based on grain size
        const endY = Math.min(y + step, height);
        const endX = Math.min(x + step, width);

        for (let dy = y; dy < endY; dy++) {
          for (let dx = x; dx < endX; dx++) {
            const index = (dy * width + dx) * 4;

            // Add noise to RGB channels (preserving alpha)
            data[index] = Math.max(0, Math.min(255, data[index] + noise)); // R
            data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + noise)); // G
            data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + noise)); // B
            // data[index + 3] is alpha - leave unchanged
          }
        }
      }
    }

    // Write modified pixels back to canvas
    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error("[GrainFilter] Failed to apply grain effect:", error);
  }
}
