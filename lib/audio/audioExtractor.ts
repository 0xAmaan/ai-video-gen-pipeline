/**
 * Audio Extraction Utility
 *
 * Provides functionality to extract audio from video files for beat analysis.
 * Primary approach: Client-side extraction using mediabunny (streaming, efficient)
 * Fallback approach: URL passthrough (for Replicate API that accepts video URLs)
 *
 * Uses mediabunny for streaming audio extraction, matching the pattern in demux-worker.ts
 */

import {
  ALL_FORMATS,
  AudioBufferSink,
  Input,
  UrlSource,
  BlobSource,
} from "mediabunny";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Result of audio extraction operation
 */
export interface AudioExtractionResult {
  /** Extracted audio as a Blob (for client-side extraction) */
  audioBlob?: Blob;
  /** Audio URL (for URL passthrough or uploaded blob) */
  audioUrl?: string;
  /** Extraction method used */
  method: "client" | "url" | "failed";
  /** Duration of the audio in seconds */
  duration?: number;
  /** Sample rate of the audio */
  sampleRate?: number;
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Options for audio extraction
 */
export interface AudioExtractionOptions {
  /** Preferred audio format (default: "wav") */
  format?: "aac" | "wav" | "webm";
  /** Target bitrate for compressed formats in bps (default: 128000) */
  bitrate?: number;
  /** Whether to prefer URL passthrough over client extraction */
  preferUrlPassthrough?: boolean;
}

/**
 * Browser capability flags
 */
interface BrowserCapabilities {
  hasAudioContext: boolean;
  hasWebCodecs: boolean;
  supportedMimeTypes: string[];
}

// ============================================================================
// Browser Compatibility Checks
// ============================================================================

/**
 * Check browser capabilities for audio extraction using mediabunny + Web Audio API
 */
export function checkBrowserCapabilities(): BrowserCapabilities {
  const capabilities: BrowserCapabilities = {
    hasAudioContext:
      typeof AudioContext !== "undefined" ||
      typeof (window as any).webkitAudioContext !== "undefined",
    hasWebCodecs: typeof AudioDecoder !== "undefined",
    supportedMimeTypes: [],
  };

  return capabilities;
}

/**
 * Simplified check for browser support (returns boolean only)
 */
export function isBrowserSupported(): boolean {
  const caps = checkBrowserCapabilities();
  return caps.hasAudioContext && caps.hasWebCodecs;
}

// ============================================================================
// Main Extraction Functions
// ============================================================================

/**
 * Extract audio from video using client-side processing with mediabunny
 *
 * Uses mediabunny's streaming audio extraction (similar to demux-worker.ts pattern)
 * for efficient, low-memory audio extraction from video files.
 *
 * @param videoSource - Video URL or Blob to extract audio from
 * @param options - Extraction options
 * @returns Audio extraction result with blob and metadata
 */
export async function extractAudioClient(
  videoSource: string | Blob,
  options: AudioExtractionOptions = {}
): Promise<AudioExtractionResult> {
  try {
    // Check browser capabilities
    if (!isBrowserSupported()) {
      return {
        method: "failed",
        error:
          "Browser does not support WebCodecs API required for audio extraction",
      };
    }

    // Create mediabunny Input from source
    const input = new Input({
      source:
        typeof videoSource === "string"
          ? new UrlSource(videoSource)
          : new BlobSource(videoSource),
      formats: ALL_FORMATS,
    });

    // Get audio track and metadata
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      input.dispose();
      return {
        method: "failed",
        error: "No audio track found in video file",
      };
    }

    const duration = await input.computeDuration();
    const sampleRate = audioTrack.sampleRate;

    // Extract audio buffers and encode to Blob
    const audioBlob = await extractAudioBuffersToBlob(
      audioTrack,
      duration,
      options
    );

    // Cleanup
    input.dispose();

    return {
      audioBlob,
      method: "client",
      duration,
      sampleRate,
    };
  } catch (error) {
    return {
      method: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main audio extraction function with automatic fallback
 *
 * This function attempts client-side extraction first, then falls back to
 * URL passthrough if extraction fails or if preferUrlPassthrough is set.
 *
 * **Primary approach**: Client-side mediabunny extraction
 * **Fallback**: URL passthrough (Replicate accepts video URLs)
 *
 * @param videoSource - Video URL or Blob
 * @param options - Extraction options
 * @returns Audio extraction result
 */
export async function extractAudioFromVideo(
  videoSource: string | Blob,
  options: AudioExtractionOptions = {}
): Promise<AudioExtractionResult> {
  // If URL passthrough is preferred and we have a URL, return it directly
  if (options.preferUrlPassthrough && typeof videoSource === "string") {
    return {
      audioUrl: videoSource,
      method: "url",
    };
  }

  // Try client-side extraction first
  const clientResult = await extractAudioClient(videoSource, options);

  // If client extraction succeeded, return it
  if (clientResult.method === "client" && clientResult.audioBlob) {
    return clientResult;
  }

  // Fallback to URL passthrough if we have a URL
  if (typeof videoSource === "string") {
    return {
      audioUrl: videoSource,
      method: "url",
      error: clientResult.error, // Include original error for debugging
    };
  }

  // If we only have a Blob and extraction failed, return the error
  return clientResult;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract audio buffers from track and encode to Blob
 *
 * Uses mediabunny's AudioBufferSink to stream audio buffers from the track,
 * then encodes to WAV format.
 *
 * @param audioTrack - Audio track from mediabunny Input
 * @param duration - Total duration in seconds
 * @param options - Encoding options
 * @returns Encoded audio Blob
 */
async function extractAudioBuffersToBlob(
  audioTrack: any,
  duration: number,
  options: AudioExtractionOptions
): Promise<Blob> {
  const sink = new AudioBufferSink(audioTrack);
  const audioBuffers: AudioBuffer[] = [];

  // Collect all audio buffers using streaming sink
  for await (const entry of sink.buffers()) {
    audioBuffers.push(entry.buffer);
  }

  if (audioBuffers.length === 0) {
    throw new Error("No audio buffers extracted from track");
  }

  // Encode buffers to WAV Blob
  return await encodeAudioBuffersToWav(audioBuffers);
}

/**
 * Encode audio buffers to WAV Blob
 *
 * Merges multiple AudioBuffer objects into a single WAV file.
 *
 * @param buffers - Array of AudioBuffer objects
 * @returns WAV-encoded audio Blob
 */
async function encodeAudioBuffersToWav(
  buffers: AudioBuffer[]
): Promise<Blob> {
  if (buffers.length === 0) {
    throw new Error("No audio buffers to encode");
  }

  const firstBuffer = buffers[0];
  const sampleRate = firstBuffer.sampleRate;
  const numberOfChannels = firstBuffer.numberOfChannels;
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);

  // Create offline context to merge buffers
  const offlineContext = new OfflineAudioContext(
    numberOfChannels,
    totalLength,
    sampleRate
  );

  // Merge all buffers
  let offset = 0;
  for (const buffer of buffers) {
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(offset / sampleRate);
    offset += buffer.length;
  }

  // Render to final buffer
  const renderedBuffer = await offlineContext.startRendering();

  // Convert to WAV format
  const wavData = audioBufferToWav(renderedBuffer);
  return new Blob([wavData], { type: "audio/wav" });
}

/**
 * Convert AudioBuffer to WAV format (PCM 16-bit)
 *
 * @param buffer - The AudioBuffer to convert
 * @returns ArrayBuffer containing WAV file data
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const data = interleaveChannels(buffer);
  const dataLength = data.length * bytesPerSample;

  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return arrayBuffer;
}

/**
 * Interleave multiple channels into a single array
 */
function interleaveChannels(buffer: AudioBuffer): Float32Array {
  const numberOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numberOfChannels;
  const result = new Float32Array(length);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      result[offset++] = channels[channel][i];
    }
  }

  return result;
}

/**
 * Write a string to a DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Validate video/audio URL accessibility
 *
 * @param url - URL to validate
 * @returns Whether the URL is accessible
 */
export async function validateAudioUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
