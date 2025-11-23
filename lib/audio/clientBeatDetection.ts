/**
 * Client-Side Beat Detection
 *
 * Provides client-side beat detection using web-audio-beat-detector library.
 * This serves as a fallback to server-side beat analysis or for offline analysis.
 *
 * Note: Client-side detection lacks downbeat distinction compared to server-side
 * (Replicate) analysis. All beats are marked with a default strength of 0.8.
 *
 * @module clientBeatDetection
 */

import { guess } from "web-audio-beat-detector";
import { extractAudioClient } from "./audioExtractor";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Beat marker matching Convex schema
 */
export interface BeatMarker {
  /** Time of the beat in seconds */
  time: number;
  /** Strength of the beat (0.0 to 1.0) */
  strength?: number;
  /** Whether this is a downbeat (measure start) */
  isDownbeat?: boolean;
}

/**
 * Result of client-side beat detection
 */
export interface ClientBeatDetectionResult {
  /** Detected BPM (beats per minute) */
  bpm: number;
  /** Array of beat markers with timestamps */
  beatMarkers: BeatMarker[];
  /** Analysis method used */
  analysisMethod: "client";
  /** Error message if detection failed */
  error?: string;
}

/**
 * Options for beat detection
 */
export interface BeatDetectionOptions {
  /** Minimum expected tempo in BPM (default: 60) */
  minTempo?: number;
  /** Maximum expected tempo in BPM (default: 180) */
  maxTempo?: number;
  /** Default beat strength for non-downbeat markers (default: 0.8) */
  defaultStrength?: number;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect beats in an AudioBuffer using client-side analysis
 *
 * Uses web-audio-beat-detector to analyze the audio and generate beat markers.
 * Since this library doesn't distinguish downbeats, all beats are marked with
 * a default strength (0.8).
 *
 * **Limitations:**
 * - No downbeat detection (all beats marked with `isDownbeat: false`)
 * - Less accurate than server-side analysis for complex rhythms
 * - Best suited for electronic music with clear, consistent beats
 *
 * **Usage with AudioBuffer:**
 * ```typescript
 * // If you already have an AudioBuffer
 * const result = await detectBeatsClientSide(audioBuffer);
 * console.log(`Detected ${result.beatMarkers.length} beats at ${result.bpm} BPM`);
 * ```
 *
 * **Usage with video source (recommended):**
 * ```typescript
 * // Automatically extracts audio and detects beats
 * const result = await detectBeatsFromVideo(videoUrl);
 * console.log(`Detected ${result.beatMarkers.length} beats at ${result.bpm} BPM`);
 * ```
 *
 * @param audioBuffer - The AudioBuffer to analyze
 * @param options - Detection options
 * @returns Beat detection result with BPM and beat markers
 */
export async function detectBeatsClientSide(
  audioBuffer: AudioBuffer,
  options: BeatDetectionOptions = {}
): Promise<ClientBeatDetectionResult> {
  // Validate input
  if (!audioBuffer || audioBuffer.length === 0) {
    return {
      bpm: 0,
      beatMarkers: [],
      analysisMethod: "client",
      error: "Invalid or empty AudioBuffer provided",
    };
  }

  // Set default options
  const {
    minTempo = 60,
    maxTempo = 180,
    defaultStrength = 0.8,
  } = options;

  try {
    // Use web-audio-beat-detector's guess() function
    // Returns: { bpm, offset, tempo }
    const result = await guess(audioBuffer, {
      minTempo,
      maxTempo,
    });

    const { bpm, offset } = result;

    // Validate BPM result
    if (!bpm || bpm <= 0) {
      return {
        bpm: 0,
        beatMarkers: [],
        analysisMethod: "client",
        error: "Could not detect valid BPM in audio",
      };
    }

    // Generate beat markers based on BPM and offset
    const beatMarkers = generateBeatMarkers(
      audioBuffer.duration,
      bpm,
      offset,
      defaultStrength
    );

    return {
      bpm,
      beatMarkers,
      analysisMethod: "client",
    };
  } catch (error) {
    return {
      bpm: 0,
      beatMarkers: [],
      analysisMethod: "client",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate beat markers from BPM and offset
 *
 * Calculates beat positions throughout the audio duration based on:
 * - BPM (beats per minute)
 * - Offset (time of first beat in seconds)
 *
 * Since client-side detection doesn't provide downbeat information,
 * all beats are marked with `isDownbeat: false`.
 *
 * @param duration - Total audio duration in seconds
 * @param bpm - Detected beats per minute
 * @param offset - Time of first beat in seconds
 * @param strength - Default strength for all beats
 * @returns Array of beat markers
 */
function generateBeatMarkers(
  duration: number,
  bpm: number,
  offset: number,
  strength: number
): BeatMarker[] {
  const beatMarkers: BeatMarker[] = [];

  // Calculate time between beats in seconds
  const beatInterval = 60 / bpm;

  // Generate markers starting from offset
  let currentTime = offset;

  while (currentTime < duration) {
    beatMarkers.push({
      time: currentTime,
      strength,
      isDownbeat: false, // Client-side detection doesn't provide downbeat info
    });

    currentTime += beatInterval;
  }

  return beatMarkers;
}

/**
 * Detect beats from a video source (URL or Blob)
 *
 * This is a convenience function that combines audio extraction and beat detection
 * in a single call. It extracts audio from the video using the Web Audio API,
 * then analyzes it for beats.
 *
 * **Usage:**
 * ```typescript
 * // From URL
 * const result = await detectBeatsFromVideo('https://example.com/video.mp4');
 *
 * // From Blob
 * const videoBlob = new Blob([videoData], { type: 'video/mp4' });
 * const result = await detectBeatsFromVideo(videoBlob);
 *
 * // With options
 * const result = await detectBeatsFromVideo(videoUrl, {
 *   minTempo: 100,
 *   maxTempo: 140,
 *   defaultStrength: 0.9,
 * });
 * ```
 *
 * @param videoSource - Video URL or Blob to analyze
 * @param options - Beat detection options
 * @returns Beat detection result with BPM and beat markers
 */
export async function detectBeatsFromVideo(
  videoSource: string | Blob,
  options: BeatDetectionOptions = {}
): Promise<ClientBeatDetectionResult> {
  try {
    // Extract audio from video
    const extraction = await extractAudioClient(videoSource);

    if (extraction.method !== "client" || !extraction.audioBlob) {
      return {
        bpm: 0,
        beatMarkers: [],
        analysisMethod: "client",
        error: extraction.error || "Audio extraction failed",
      };
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await extraction.audioBlob.arrayBuffer();

    // Decode to AudioBuffer
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Clean up AudioContext
    await audioContext.close();

    // Detect beats
    return await detectBeatsClientSide(audioBuffer, options);
  } catch (error) {
    return {
      bpm: 0,
      beatMarkers: [],
      analysisMethod: "client",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if browser supports Web Audio API for beat detection
 *
 * @returns `true` if AudioContext is available, `false` otherwise
 */
export function isClientBeatDetectionSupported(): boolean {
  if (typeof window === "undefined") {
    return false; // SSR environment
  }

  return (
    typeof AudioContext !== "undefined" ||
    typeof (window as any).webkitAudioContext !== "undefined"
  );
}
