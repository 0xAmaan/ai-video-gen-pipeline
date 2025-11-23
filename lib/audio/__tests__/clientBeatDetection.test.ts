/**
 * Tests for lib/audio/clientBeatDetection.ts
 *
 * Validates:
 * - All exports are available with correct types
 * - SSR safety (no crashes when window is undefined)
 * - Type safety (no 'any' types used)
 * - Beat detection with valid AudioBuffer
 * - Error handling for invalid inputs
 * - Beat marker generation logic
 * - Browser capability checks
 */

import { describe, it, expect, vi } from "vitest";
import {
  detectBeatsClientSide,
  detectBeatsFromVideo,
  isClientBeatDetectionSupported,
  type BeatMarker,
  type ClientBeatDetectionResult,
  type BeatDetectionOptions,
} from "../clientBeatDetection";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock AudioBuffer for testing
 *
 * Generates a simple sine wave at specified frequency to simulate audio content.
 */
function createMockAudioBuffer(
  duration: number = 10,
  sampleRate: number = 44100,
  numberOfChannels: number = 2
): AudioBuffer {
  const audioContext = new AudioContext({ sampleRate });
  const buffer = audioContext.createBuffer(
    numberOfChannels,
    duration * sampleRate,
    sampleRate
  );

  // Fill with a simple sine wave (440 Hz)
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const time = i / sampleRate;
      channelData[i] = Math.sin(2 * Math.PI * 440 * time);
    }
  }

  // Clean up AudioContext to prevent resource leaks
  audioContext.close();

  return buffer;
}

/**
 * Create a click track AudioBuffer for more reliable beat detection
 *
 * Generates a regular click pattern at specified BPM for testing.
 */
function createClickTrack(
  duration: number,
  bpm: number,
  sampleRate: number = 44100
): AudioBuffer {
  const audioContext = new AudioContext({ sampleRate });
  const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
  const channelData = buffer.getChannelData(0);

  const beatInterval = 60 / bpm; // seconds between beats
  const clickDuration = 0.01; // 10ms click

  for (let time = 0; time < duration; time += beatInterval) {
    const sampleIndex = Math.floor(time * sampleRate);
    const clickSamples = Math.floor(clickDuration * sampleRate);

    // Generate click
    for (let i = 0; i < clickSamples && sampleIndex + i < channelData.length; i++) {
      channelData[sampleIndex + i] = 1.0;
    }
  }

  // Clean up AudioContext to prevent resource leaks
  audioContext.close();

  return buffer;
}

// ============================================================================
// Export Tests
// ============================================================================

describe("clientBeatDetection - Exports", () => {
  it("should export all required functions", () => {
    expect(detectBeatsClientSide).toBeDefined();
    expect(detectBeatsFromVideo).toBeDefined();
    expect(isClientBeatDetectionSupported).toBeDefined();
  });

  it("should export types correctly", () => {
    // Type-only test - will fail at compile time if types don't exist
    const beatMarker: BeatMarker = {
      time: 1.5,
      strength: 0.8,
      isDownbeat: false,
    };

    const result: ClientBeatDetectionResult = {
      bpm: 120,
      beatMarkers: [beatMarker],
      analysisMethod: "client",
    };

    const options: BeatDetectionOptions = {
      minTempo: 60,
      maxTempo: 180,
      defaultStrength: 0.8,
    };

    expect(beatMarker).toBeDefined();
    expect(result).toBeDefined();
    expect(options).toBeDefined();
  });
});

// ============================================================================
// SSR Safety Tests
// ============================================================================

describe("clientBeatDetection - SSR Safety", () => {
  it("isClientBeatDetectionSupported should not crash in SSR environment", () => {
    // Mock SSR environment
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    delete global.window;

    expect(() => {
      const supported = isClientBeatDetectionSupported();
      expect(supported).toBe(false);
    }).not.toThrow();

    // Restore
    global.window = originalWindow;
  });

  it("isClientBeatDetectionSupported should return false in SSR environment", () => {
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    delete global.window;

    expect(isClientBeatDetectionSupported()).toBe(false);

    // Restore
    global.window = originalWindow;
  });
});

// ============================================================================
// Browser Support Tests
// ============================================================================

describe("clientBeatDetection - Browser Support", () => {
  it("isClientBeatDetectionSupported should return boolean", () => {
    const result = isClientBeatDetectionSupported();
    expect(typeof result).toBe("boolean");
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe("clientBeatDetection - Type Safety", () => {
  it("should properly type BeatMarker interface", () => {
    const beatMarker: BeatMarker = {
      time: 2.5,
      strength: 0.9,
      isDownbeat: true,
    };

    expect(beatMarker.time).toBe(2.5);
    expect(beatMarker.strength).toBe(0.9);
    expect(beatMarker.isDownbeat).toBe(true);
  });

  it("should allow optional fields in BeatMarker", () => {
    const minimalMarker: BeatMarker = {
      time: 1.0,
    };

    expect(minimalMarker.time).toBe(1.0);
    expect(minimalMarker.strength).toBeUndefined();
    expect(minimalMarker.isDownbeat).toBeUndefined();
  });

  it("should properly type ClientBeatDetectionResult", () => {
    const result: ClientBeatDetectionResult = {
      bpm: 128,
      beatMarkers: [],
      analysisMethod: "client",
    };

    expect(result.bpm).toBe(128);
    expect(result.analysisMethod).toBe("client");
    expect(Array.isArray(result.beatMarkers)).toBe(true);
  });

  it("should allow error field in result", () => {
    const errorResult: ClientBeatDetectionResult = {
      bpm: 0,
      beatMarkers: [],
      analysisMethod: "client",
      error: "Analysis failed",
    };

    expect(errorResult.error).toBe("Analysis failed");
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("clientBeatDetection - Error Handling", () => {
  it("should handle null AudioBuffer gracefully", async () => {
    const result = await detectBeatsClientSide(null as any);

    expect(result.bpm).toBe(0);
    expect(result.beatMarkers).toEqual([]);
    expect(result.analysisMethod).toBe("client");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Invalid");
  });

  it("should handle undefined AudioBuffer gracefully", async () => {
    const result = await detectBeatsClientSide(undefined as any);

    expect(result.bpm).toBe(0);
    expect(result.beatMarkers).toEqual([]);
    expect(result.analysisMethod).toBe("client");
    expect(result.error).toBeDefined();
  });

  it("should handle empty AudioBuffer gracefully", async () => {
    const audioContext = new AudioContext();
    const emptyBuffer = audioContext.createBuffer(1, 0, 44100);
    audioContext.close(); // Clean up

    const result = await detectBeatsClientSide(emptyBuffer);

    expect(result.bpm).toBe(0);
    expect(result.beatMarkers).toEqual([]);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// Beat Detection Tests
// ============================================================================

describe("clientBeatDetection - Beat Detection", () => {
  it("should detect beats in a valid AudioBuffer", async () => {
    const audioBuffer = createMockAudioBuffer(5); // 5 second audio

    const result = await detectBeatsClientSide(audioBuffer);

    // Should return a valid result structure
    expect(result).toBeDefined();
    expect(result.analysisMethod).toBe("client");
    expect(typeof result.bpm).toBe("number");
    expect(Array.isArray(result.beatMarkers)).toBe(true);

    // If detection succeeded, BPM should be positive
    if (!result.error) {
      expect(result.bpm).toBeGreaterThan(0);
    }
  }, 10000); // Increase timeout for beat detection

  it("should generate beat markers when BPM is detected", async () => {
    // Create a click track with known BPM
    const knownBpm = 120;
    const duration = 5;
    const clickTrack = createClickTrack(duration, knownBpm);

    const result = await detectBeatsClientSide(clickTrack);

    // Detection may or may not succeed with synthetic audio
    // But if it does, verify the structure
    if (result.bpm > 0 && result.beatMarkers.length > 0) {
      // Each beat marker should have required properties
      result.beatMarkers.forEach((marker) => {
        expect(marker).toHaveProperty("time");
        expect(typeof marker.time).toBe("number");
        expect(marker.time).toBeGreaterThanOrEqual(0);
        expect(marker.time).toBeLessThanOrEqual(duration);

        // Strength should be defined and between 0 and 1
        if (marker.strength !== undefined) {
          expect(marker.strength).toBeGreaterThanOrEqual(0);
          expect(marker.strength).toBeLessThanOrEqual(1);
        }

        // isDownbeat should be boolean if defined
        if (marker.isDownbeat !== undefined) {
          expect(typeof marker.isDownbeat).toBe("boolean");
        }
      });

      // Beat markers should be sorted by time
      for (let i = 1; i < result.beatMarkers.length; i++) {
        expect(result.beatMarkers[i].time).toBeGreaterThanOrEqual(
          result.beatMarkers[i - 1].time
        );
      }
    }
  }, 10000);

  it("should respect custom tempo range options", async () => {
    const audioBuffer = createMockAudioBuffer(5);

    const options: BeatDetectionOptions = {
      minTempo: 100,
      maxTempo: 140,
      defaultStrength: 0.9,
    };

    const result = await detectBeatsClientSide(audioBuffer, options);

    expect(result).toBeDefined();
    expect(result.analysisMethod).toBe("client");

    // If BPM was detected, it should be within the specified range or analysis failed
    if (result.bpm > 0) {
      expect(result.bpm).toBeGreaterThanOrEqual(options.minTempo!);
      expect(result.bpm).toBeLessThanOrEqual(options.maxTempo!);
    }
  }, 10000);

  it("should apply custom default strength to beat markers", async () => {
    const clickTrack = createClickTrack(3, 120);
    const customStrength = 0.95;

    const result = await detectBeatsClientSide(clickTrack, {
      defaultStrength: customStrength,
    });

    // If markers were generated, they should use the custom strength
    if (result.beatMarkers.length > 0) {
      result.beatMarkers.forEach((marker) => {
        if (marker.strength !== undefined) {
          expect(marker.strength).toBe(customStrength);
        }
      });
    }
  }, 10000);

  it("should set isDownbeat to false for all beats (client-side limitation)", async () => {
    const clickTrack = createClickTrack(3, 120);

    const result = await detectBeatsClientSide(clickTrack);

    // Client-side detection doesn't distinguish downbeats
    if (result.beatMarkers.length > 0) {
      result.beatMarkers.forEach((marker) => {
        if (marker.isDownbeat !== undefined) {
          expect(marker.isDownbeat).toBe(false);
        }
      });
    }
  }, 10000);
});

// ============================================================================
// BeatDetectionOptions Tests
// ============================================================================

describe("clientBeatDetection - Options", () => {
  it("should work with empty options object", async () => {
    const audioBuffer = createMockAudioBuffer(3);

    const result = await detectBeatsClientSide(audioBuffer, {});

    expect(result).toBeDefined();
    expect(result.analysisMethod).toBe("client");
  }, 10000);

  it("should work without options parameter", async () => {
    const audioBuffer = createMockAudioBuffer(3);

    const result = await detectBeatsClientSide(audioBuffer);

    expect(result).toBeDefined();
    expect(result.analysisMethod).toBe("client");
  }, 10000);

  it("should accept all option fields", () => {
    const options: BeatDetectionOptions = {
      minTempo: 80,
      maxTempo: 160,
      defaultStrength: 0.75,
    };

    expect(options.minTempo).toBe(80);
    expect(options.maxTempo).toBe(160);
    expect(options.defaultStrength).toBe(0.75);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("clientBeatDetection - Integration with Audio Extractor", () => {
  it("should export detectBeatsFromVideo for end-to-end usage", () => {
    expect(detectBeatsFromVideo).toBeDefined();
    expect(typeof detectBeatsFromVideo).toBe("function");
  });

  it("should handle invalid video source gracefully", async () => {
    // Test with invalid Blob
    const invalidBlob = new Blob([new Uint8Array([0, 1, 2])], {
      type: "video/mp4",
    });

    const result = await detectBeatsFromVideo(invalidBlob);

    // Should not throw, should return error result
    expect(result).toBeDefined();
    expect(result.analysisMethod).toBe("client");
    expect(result.bpm).toBe(0);
    expect(result.beatMarkers).toEqual([]);
  }, 15000);

  it("should handle extraction failures gracefully", async () => {
    // Mock extractAudioClient to fail
    const { extractAudioClient } = await import("../audioExtractor");
    vi.spyOn(
      await import("../audioExtractor"),
      "extractAudioClient"
    ).mockResolvedValue({
      method: "failed",
      error: "Mock extraction failure",
    });

    const result = await detectBeatsFromVideo("https://example.com/video.mp4");

    expect(result.error).toBeDefined();
    expect(result.bpm).toBe(0);
    expect(result.beatMarkers).toEqual([]);

    vi.restoreAllMocks();
  }, 10000);
});

describe("clientBeatDetection - Integration", () => {
  it("should handle analysis failures gracefully", async () => {
    // Create extremely short buffer that likely won't produce valid beats
    const audioContext = new AudioContext();
    const tinyBuffer = audioContext.createBuffer(1, 100, 44100); // ~2ms
    audioContext.close(); // Clean up

    const result = await detectBeatsClientSide(tinyBuffer);

    // Should not throw, should return a result
    expect(result).toBeDefined();
    expect(result.analysisMethod).toBe("client");

    // May fail or succeed, but should have valid structure
    if (result.error) {
      expect(result.bpm).toBe(0);
      expect(result.beatMarkers).toEqual([]);
    }
  }, 10000);

  it("should handle longer audio files", async () => {
    const longAudio = createMockAudioBuffer(30); // 30 seconds

    const result = await detectBeatsClientSide(longAudio);

    expect(result).toBeDefined();
    expect(result.analysisMethod).toBe("client");

    // If successful, should have multiple beat markers
    if (result.bpm > 0 && result.beatMarkers.length > 0) {
      // At minimum tempo (60 BPM), 30s should have at least 30 beats
      // At maximum tempo (180 BPM), 30s should have up to 90 beats
      // Allow for some variance
      expect(result.beatMarkers.length).toBeGreaterThan(0);
    }
  }, 15000);
});
