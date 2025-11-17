import type { SpeedKeyframe } from "../types";
import { sampleSpeedCurve } from "./speed-interpolation";

export interface SpeedPreset {
  id: string;
  name: string;
  description: string;
  category: "ramps" | "effects" | "custom";
  keyframes: SpeedKeyframe[];
  thumbnailColor?: string; // Optional custom color for the preview curve
}

/**
 * Built-in speed effect presets
 * Each preset includes keyframe definitions and metadata for display
 */
export const SPEED_PRESETS: SpeedPreset[] = [
  // Linear Ramps
  {
    id: "linear-ramp-up",
    name: "Linear Ramp Up",
    description: "Smooth acceleration from 0.5x to 2x",
    category: "ramps",
    keyframes: [
      { time: 0, speed: 0.5 },
      { time: 1, speed: 2.0 },
    ],
    thumbnailColor: "#10b981", // green
  },
  {
    id: "linear-ramp-down",
    name: "Linear Ramp Down",
    description: "Smooth deceleration from 2x to 0.5x",
    category: "ramps",
    keyframes: [
      { time: 0, speed: 2.0 },
      { time: 1, speed: 0.5 },
    ],
    thumbnailColor: "#f59e0b", // amber
  },

  // Ease Effects
  {
    id: "ease-in",
    name: "Ease In",
    description: "Slow start with acceleration",
    category: "ramps",
    keyframes: [
      { time: 0, speed: 0.3 },
      { time: 0.3, speed: 0.5 },
      { time: 0.6, speed: 0.8 },
      { time: 0.8, speed: 1.2 },
      { time: 1, speed: 2.0 },
    ],
    thumbnailColor: "#3b82f6", // blue
  },
  {
    id: "ease-out",
    name: "Ease Out",
    description: "Fast start with deceleration",
    category: "ramps",
    keyframes: [
      { time: 0, speed: 2.0 },
      { time: 0.2, speed: 1.2 },
      { time: 0.4, speed: 0.8 },
      { time: 0.7, speed: 0.5 },
      { time: 1, speed: 0.3 },
    ],
    thumbnailColor: "#8b5cf6", // violet
  },

  // Special Effects
  {
    id: "freeze-frame",
    name: "Freeze Frame",
    description: "Pause in the middle (1x → 0x → 1x)",
    category: "effects",
    keyframes: [
      { time: 0, speed: 1.0 },
      { time: 0.4, speed: 1.0 },
      { time: 0.5, speed: 0 },
      { time: 0.6, speed: 1.0 },
      { time: 1, speed: 1.0 },
    ],
    thumbnailColor: "#ef4444", // red
  },
  {
    id: "speed-burst",
    name: "Speed Burst",
    description: "Quick burst of speed (1x → 3x → 1x)",
    category: "effects",
    keyframes: [
      { time: 0, speed: 1.0 },
      { time: 0.3, speed: 1.5 },
      { time: 0.5, speed: 3.0 },
      { time: 0.7, speed: 1.5 },
      { time: 1, speed: 1.0 },
    ],
    thumbnailColor: "#ec4899", // pink
  },
  {
    id: "slow-motion",
    name: "Slow Motion",
    description: "Constant 0.5x slow motion",
    category: "effects",
    keyframes: [
      { time: 0, speed: 0.5 },
      { time: 1, speed: 0.5 },
    ],
    thumbnailColor: "#06b6d4", // cyan
  },
  {
    id: "time-lapse",
    name: "Time Lapse",
    description: "Constant 3x fast forward",
    category: "effects",
    keyframes: [
      { time: 0, speed: 3.0 },
      { time: 1, speed: 3.0 },
    ],
    thumbnailColor: "#f97316", // orange
  },

  // Advanced Effects
  {
    id: "dramatic-pause",
    name: "Dramatic Pause",
    description: "Slow down before freeze (1x → 0.2x → 0x → 1x)",
    category: "effects",
    keyframes: [
      { time: 0, speed: 1.0 },
      { time: 0.35, speed: 1.0 },
      { time: 0.45, speed: 0.2 },
      { time: 0.5, speed: 0 },
      { time: 0.55, speed: 0.2 },
      { time: 0.65, speed: 1.0 },
      { time: 1, speed: 1.0 },
    ],
    thumbnailColor: "#dc2626", // dark red
  },
  {
    id: "bounce",
    name: "Bounce",
    description: "Playful speed variation (1x → 2x → 0.5x → 1.5x → 1x)",
    category: "effects",
    keyframes: [
      { time: 0, speed: 1.0 },
      { time: 0.25, speed: 2.0 },
      { time: 0.5, speed: 0.5 },
      { time: 0.75, speed: 1.5 },
      { time: 1, speed: 1.0 },
    ],
    thumbnailColor: "#a855f7", // purple
  },
];

/**
 * Generate a thumbnail preview of a speed curve
 * Returns a data URL for a small SVG visualization
 *
 * @param keyframes - Speed keyframes to visualize
 * @param width - Thumbnail width in pixels (default: 80)
 * @param height - Thumbnail height in pixels (default: 40)
 * @param color - Curve color (default: blue)
 * @returns Data URL for SVG image
 */
export const generateSpeedCurveThumbnail = (
  keyframes: SpeedKeyframe[],
  width: number = 80,
  height: number = 40,
  color: string = "#3b82f6",
): string => {
  const padding = 2;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Sample the curve for smooth visualization
  const samples = sampleSpeedCurve({ keyframes }, 50);

  // Find min/max speed for scaling
  const speeds = samples.map((s) => s.speed);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const speedRange = maxSpeed - minSpeed || 1; // Avoid division by zero

  // Generate SVG path
  const points = samples.map((sample) => {
    const x = padding + sample.time * graphWidth;
    const normalizedSpeed = (sample.speed - minSpeed) / speedRange;
    // Invert Y axis (0 at top, max at bottom in SVG)
    const y = padding + graphHeight * (1 - normalizedSpeed);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const pathData = `M ${points.join(" L ")}`;

  // Create SVG with path
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="transparent"/>
      <path d="${pathData}"
            stroke="${color}"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"/>
    </svg>
  `.trim();

  // Convert to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Generate thumbnail for a preset
 *
 * @param preset - Speed preset to generate thumbnail for
 * @param width - Thumbnail width
 * @param height - Thumbnail height
 * @returns Data URL for SVG thumbnail
 */
export const generatePresetThumbnail = (
  preset: SpeedPreset,
  width: number = 80,
  height: number = 40,
): string => {
  return generateSpeedCurveThumbnail(
    preset.keyframes,
    width,
    height,
    preset.thumbnailColor || "#3b82f6",
  );
};

/**
 * Get presets by category
 */
export const getPresetsByCategory = (
  category: SpeedPreset["category"],
): SpeedPreset[] => {
  return SPEED_PRESETS.filter((preset) => preset.category === category);
};

/**
 * Find a preset by ID
 */
export const getPresetById = (id: string): SpeedPreset | undefined => {
  return SPEED_PRESETS.find((preset) => preset.id === id);
};
