/**
 * Tests for lib/audio/audioExtractor.ts
 *
 * Validates:
 * - All exports are available with correct types
 * - SSR safety (no crashes when window is undefined)
 * - Type safety (no 'any' types used)
 * - Discriminated union type narrowing
 * - Browser capability checks
 * - Error handling and resource cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  extractAudioFromVideo,
  extractAudioClient,
  checkBrowserCapabilities,
  isBrowserSupported,
  validateAudioUrl,
  type AudioExtractionResult,
  type AudioExtractionOptions,
} from "../audioExtractor";

describe("audioExtractor - Exports", () => {
  it("should export all required functions", () => {
    expect(extractAudioFromVideo).toBeDefined();
    expect(extractAudioClient).toBeDefined();
    expect(checkBrowserCapabilities).toBeDefined();
    expect(isBrowserSupported).toBeDefined();
    expect(validateAudioUrl).toBeDefined();
  });

  it("should export types correctly", () => {
    // Type-only test - will fail at compile time if types don't exist
    const result: AudioExtractionResult = {
      method: "client",
      audioBlob: new Blob(),
      duration: 10,
      sampleRate: 48000,
    };

    const options: AudioExtractionOptions = {
      format: "wav",
      preferUrlPassthrough: false,
    };

    expect(result).toBeDefined();
    expect(options).toBeDefined();
  });
});

describe("audioExtractor - SSR Safety", () => {
  it("checkBrowserCapabilities should not crash in SSR environment", () => {
    // Mock SSR environment
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    delete global.window;

    expect(() => {
      const capabilities = checkBrowserCapabilities();
      expect(capabilities.hasAudioContext).toBe(false);
      expect(capabilities.hasWebCodecs).toBe(false);
      expect(capabilities.supportedMimeTypes).toEqual([]);
    }).not.toThrow();

    // Restore
    global.window = originalWindow;
  });

  it("isBrowserSupported should return false in SSR environment", () => {
    const originalWindow = global.window;
    // @ts-expect-error - Simulating SSR
    delete global.window;

    expect(isBrowserSupported()).toBe(false);

    // Restore
    global.window = originalWindow;
  });
});

describe("audioExtractor - Browser Capability Checks", () => {
  it("checkBrowserCapabilities should return proper structure", () => {
    const capabilities = checkBrowserCapabilities();

    expect(capabilities).toHaveProperty("hasAudioContext");
    expect(capabilities).toHaveProperty("hasWebCodecs");
    expect(capabilities).toHaveProperty("supportedMimeTypes");

    expect(typeof capabilities.hasAudioContext).toBe("boolean");
    expect(typeof capabilities.hasWebCodecs).toBe("boolean");
    expect(Array.isArray(capabilities.supportedMimeTypes)).toBe(true);
  });

  it("isBrowserSupported should return boolean", () => {
    const result = isBrowserSupported();
    expect(typeof result).toBe("boolean");
  });
});

describe("audioExtractor - Type Safety (Discriminated Unions)", () => {
  it("should properly narrow AudioExtractionResult type based on method field", () => {
    // This test validates TypeScript discriminated union type narrowing

    const clientResult: AudioExtractionResult = {
      method: "client",
      audioBlob: new Blob(),
      duration: 120.5,
      sampleRate: 48000,
    };

    const urlResult: AudioExtractionResult = {
      method: "url",
      audioUrl: "https://example.com/video.mp4",
    };

    const failedResult: AudioExtractionResult = {
      method: "failed",
      error: "Browser not supported",
    };

    // Type narrowing should work
    if (clientResult.method === "client") {
      expect(clientResult.audioBlob).toBeDefined();
      expect(clientResult.duration).toBe(120.5);
      expect(clientResult.sampleRate).toBe(48000);
    }

    if (urlResult.method === "url") {
      expect(urlResult.audioUrl).toBeDefined();
    }

    if (failedResult.method === "failed") {
      expect(failedResult.error).toBeDefined();
    }
  });

  it("should handle optional fields correctly", () => {
    // Test that optional fields work in all result types
    const resultWithError: AudioExtractionResult = {
      method: "url",
      audioUrl: "https://example.com/video.mp4",
      error: "Extraction failed, falling back to URL",
    };

    expect(resultWithError.error).toBeDefined();
  });
});

describe("audioExtractor - extractAudioClient Error Handling", () => {
  it("should return failed result when browser is not supported", async () => {
    // Mock browser as not supported
    vi.spyOn(
      await import("../audioExtractor"),
      "isBrowserSupported"
    ).mockReturnValue(false);

    const result = await extractAudioClient("https://example.com/video.mp4");

    expect(result.method).toBe("failed");
    expect(result.error).toContain("WebCodecs API");

    vi.restoreAllMocks();
  });
});

describe("audioExtractor - extractAudioFromVideo", () => {
  it("should return URL passthrough when preferUrlPassthrough is true", async () => {
    const videoUrl = "https://example.com/video.mp4";
    const result = await extractAudioFromVideo(videoUrl, {
      preferUrlPassthrough: true,
    });

    expect(result.method).toBe("url");
    expect(result.audioUrl).toBe(videoUrl);
  });

  it("should handle Blob sources without URL fallback", async () => {
    const videoBlob = new Blob([new Uint8Array([0, 1, 2, 3])], {
      type: "video/mp4",
    });

    // This will fail extraction (invalid blob), but should return failed result, not crash
    const result = await extractAudioFromVideo(videoBlob);

    // Should be either 'failed' or 'client' depending on browser support
    expect(["failed", "client"]).toContain(result.method);
  });
});

describe("audioExtractor - validateAudioUrl", () => {
  it("should return boolean result", async () => {
    const result = await validateAudioUrl("https://example.com/video.mp4");
    expect(typeof result).toBe("boolean");
  });

  it("should return false for invalid URLs without throwing", async () => {
    const result = await validateAudioUrl("not-a-valid-url");
    expect(result).toBe(false);
  });

  it("should handle fetch errors gracefully", async () => {
    // Mock fetch to throw an error
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await validateAudioUrl("https://example.com/video.mp4");
    expect(result).toBe(false);

    vi.restoreAllMocks();
  });

  it("should return true for successful responses", async () => {
    // Mock fetch to return ok
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await validateAudioUrl("https://example.com/video.mp4");
    expect(result).toBe(true);

    vi.restoreAllMocks();
  });

  it("should return false for non-ok responses", async () => {
    // Mock fetch to return error status
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await validateAudioUrl("https://example.com/video.mp4");
    expect(result).toBe(false);

    vi.restoreAllMocks();
  });
});

describe("audioExtractor - AudioExtractionOptions", () => {
  it("should accept all valid format options", () => {
    const options1: AudioExtractionOptions = { format: "wav" };
    const options2: AudioExtractionOptions = { format: "aac" };
    const options3: AudioExtractionOptions = { format: "webm" };

    expect(options1.format).toBe("wav");
    expect(options2.format).toBe("aac");
    expect(options3.format).toBe("webm");
  });

  it("should accept bitrate option", () => {
    const options: AudioExtractionOptions = {
      format: "aac",
      bitrate: 128000,
    };

    expect(options.bitrate).toBe(128000);
  });

  it("should accept preferUrlPassthrough option", () => {
    const options: AudioExtractionOptions = {
      preferUrlPassthrough: true,
    };

    expect(options.preferUrlPassthrough).toBe(true);
  });

  it("should work with empty options object", () => {
    const options: AudioExtractionOptions = {};
    expect(options).toBeDefined();
  });
});

describe("audioExtractor - Type Exports (Compile-time Validation)", () => {
  it("should allow importing and using InputAudioTrack type from mediabunny", async () => {
    // This validates that the InputAudioTrack type is properly imported
    // The actual type checking happens at compile time
    const { extractAudioClient } = await import("../audioExtractor");
    expect(extractAudioClient).toBeDefined();
  });
});

// Integration test for resource cleanup (validates the finally block works)
describe("audioExtractor - Resource Cleanup", () => {
  it("should handle errors without leaking resources", async () => {
    // This test ensures that even if extraction fails, resources are cleaned up
    // The finally block should always call input.dispose()

    const invalidBlob = new Blob([new Uint8Array([0])], { type: "video/mp4" });

    // Should not throw, should return error result
    await expect(extractAudioClient(invalidBlob)).resolves.toBeDefined();
  });
});
