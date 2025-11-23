/**
 * Waveform Generator
 * Extracts audio data from media files and generates waveform visualization data
 */

export interface WaveformData {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
  channelCount: number;
}

export interface WaveformGeneratorOptions {
  samplesPerSecond?: number; // How many samples per second for visualization (default: 100)
  normalize?: boolean; // Normalize amplitude to 0-1 range (default: true)
}

/**
 * Generate waveform data from an audio/video URL
 */
export const generateWaveform = async (
  url: string,
  options: WaveformGeneratorOptions = {},
): Promise<WaveformData> => {
  const { samplesPerSecond = 100, normalize = true } = options;

  // Create audio context
  const audioContext = new AudioContext();

  try {
    // Fetch and decode audio
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get audio data from first channel (mono or left channel)
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    const channelCount = audioBuffer.numberOfChannels;

    // Calculate how many samples we want for visualization
    const targetSamples = Math.floor(duration * samplesPerSecond);
    const samplesPerBucket = Math.floor(channelData.length / targetSamples);

    // Downsample audio data by finding peak amplitude in each bucket
    const waveformSamples = new Float32Array(targetSamples);

    for (let i = 0; i < targetSamples; i++) {
      const start = i * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, channelData.length);

      // Find peak amplitude in this bucket (RMS or peak)
      let maxAmplitude = 0;
      for (let j = start; j < end; j++) {
        const amplitude = Math.abs(channelData[j]);
        if (amplitude > maxAmplitude) {
          maxAmplitude = amplitude;
        }
      }

      waveformSamples[i] = maxAmplitude;
    }

    // Normalize to 0-1 range if requested
    if (normalize) {
      let maxValue = 0;
      for (let i = 0; i < waveformSamples.length; i++) {
        if (waveformSamples[i] > maxValue) {
          maxValue = waveformSamples[i];
        }
      }

      if (maxValue > 0) {
        for (let i = 0; i < waveformSamples.length; i++) {
          waveformSamples[i] /= maxValue;
        }
      }
    }

    return {
      samples: waveformSamples,
      sampleRate,
      duration,
      channelCount,
    };
  } finally {
    // Close audio context to free resources
    await audioContext.close();
  }
};

/**
 * Generate waveform data using RMS (Root Mean Square) for smoother visualization
 */
export const generateWaveformRMS = async (
  url: string,
  options: WaveformGeneratorOptions = {},
): Promise<WaveformData> => {
  const { samplesPerSecond = 100, normalize = true } = options;

  const audioContext = new AudioContext();

  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    const channelCount = audioBuffer.numberOfChannels;

    const targetSamples = Math.floor(duration * samplesPerSecond);
    const samplesPerBucket = Math.floor(channelData.length / targetSamples);

    const waveformSamples = new Float32Array(targetSamples);

    for (let i = 0; i < targetSamples; i++) {
      const start = i * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, channelData.length);

      // Calculate RMS (Root Mean Square) for smoother waveform
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) {
        sum += channelData[j] * channelData[j];
        count++;
      }

      const rms = Math.sqrt(sum / count);
      waveformSamples[i] = rms;
    }

    // Normalize to 0-1 range if requested
    if (normalize) {
      let maxValue = 0;
      for (let i = 0; i < waveformSamples.length; i++) {
        if (waveformSamples[i] > maxValue) {
          maxValue = waveformSamples[i];
        }
      }

      if (maxValue > 0) {
        for (let i = 0; i < waveformSamples.length; i++) {
          waveformSamples[i] /= maxValue;
        }
      }
    }

    return {
      samples: waveformSamples,
      sampleRate,
      duration,
      channelCount,
    };
  } finally {
    await audioContext.close();
  }
};

/**
 * Get a subset of waveform samples for a specific time range
 * Useful for rendering only the visible portion of a clip
 */
export const getWaveformSlice = (
  waveform: WaveformData,
  startTime: number,
  endTime: number,
): Float32Array => {
  const { samples, duration } = waveform;

  // Calculate sample indices
  const samplesPerSecond = samples.length / duration;
  const startIndex = Math.floor(startTime * samplesPerSecond);
  const endIndex = Math.ceil(endTime * samplesPerSecond);

  // Clamp to valid range
  const clampedStart = Math.max(0, Math.min(startIndex, samples.length));
  const clampedEnd = Math.max(0, Math.min(endIndex, samples.length));

  // Return slice
  return samples.slice(clampedStart, clampedEnd);
};

/**
 * Resample waveform data to a target number of samples
 * Useful for adjusting waveform resolution based on zoom level
 */
export const resampleWaveform = (
  samples: Float32Array,
  targetSampleCount: number,
): Float32Array => {
  if (samples.length === targetSampleCount) {
    return samples;
  }

  const result = new Float32Array(targetSampleCount);
  const ratio = samples.length / targetSampleCount;

  for (let i = 0; i < targetSampleCount; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);

    // Find max amplitude in this range
    let maxValue = 0;
    for (let j = start; j < end && j < samples.length; j++) {
      if (samples[j] > maxValue) {
        maxValue = samples[j];
      }
    }

    result[i] = maxValue;
  }

  return result;
};

/**
 * Cache for storing generated waveforms
 */
export class WaveformCache {
  private cache: Map<string, WaveformData> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  get(key: string): WaveformData | undefined {
    return this.cache.get(key);
  }

  set(key: string, data: WaveformData): void {
    // Simple LRU: if cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, data);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
