import type { Clip, ExportOptions } from "../types";

/**
 * Generates FFmpeg command arguments for multi-clip export
 * This is used by the main process to construct the ffmpeg command
 */

export interface ExportCommand {
  mode: "fast" | "reencode";
  clips: Array<{
    sourceFilePath: string;
    sourceStart: number;
    sourceEnd: number;
  }>;
  outputPath: string;
  resolution?: "720p" | "1080p" | "source";
}

/**
 * Prepares export command data from clips
 */
export const prepareExportCommand = (
  clips: Clip[],
  outputPath: string,
  options: ExportOptions,
): ExportCommand => {
  // Sort clips by timeline position
  const sortedClips = [...clips].sort(
    (a, b) => a.timelineStart - b.timelineStart,
  );

  return {
    mode: options.mode,
    clips: sortedClips.map((clip) => ({
      sourceFilePath: clip.sourceFilePath,
      sourceStart: clip.sourceStart,
      sourceEnd: clip.sourceEnd,
    })),
    outputPath,
    resolution: options.resolution,
  };
};

/**
 * Validates export options and clips
 */
export const validateExportData = (
  clips: Clip[],
  options: ExportOptions,
): { valid: boolean; error?: string } => {
  if (clips.length === 0) {
    return { valid: false, error: "No clips to export" };
  }

  // Check if all clips have valid source paths
  for (const clip of clips) {
    if (!clip.sourceFilePath) {
      return { valid: false, error: `Clip ${clip.id} has no source file` };
    }

    if (clip.sourceEnd <= clip.sourceStart) {
      return { valid: false, error: `Clip ${clip.id} has invalid trim range` };
    }
  }

  // Validate resolution option for re-encode mode
  if (options.mode === "reencode" && !options.resolution) {
    return {
      valid: false,
      error: "Resolution must be specified for re-encode mode",
    };
  }

  return { valid: true };
};

/**
 * Calculates estimated export time based on clip durations and mode
 */
export const estimateExportTime = (
  clips: Clip[],
  mode: "fast" | "reencode",
): number => {
  const totalDuration = clips.reduce(
    (sum, clip) => sum + (clip.sourceEnd - clip.sourceStart),
    0,
  );

  // Fast mode: ~0.1x real-time (10 seconds of video = 1 second export)
  // Re-encode mode: ~0.5x real-time (10 seconds of video = 5 seconds export)
  const multiplier = mode === "fast" ? 0.1 : 0.5;

  return Math.ceil(totalDuration * multiplier);
};

/**
 * Gets resolution dimensions from resolution string
 */
export const getResolutionDimensions = (
  resolution: "720p" | "1080p" | "source",
): { width: number; height: number } | null => {
  switch (resolution) {
    case "720p":
      return { width: 1280, height: 720 };
    case "1080p":
      return { width: 1920, height: 1080 };
    case "source":
      return null; // Use source resolution
    default:
      return null;
  }
};
