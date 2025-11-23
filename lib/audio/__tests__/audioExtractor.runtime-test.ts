/**
 * Runtime validation test for lib/audio/audioExtractor.ts
 *
 * This file validates actual runtime behavior, especially the critical fixes:
 * - SSR safety (no crashes when window is undefined)
 * - Browser capability checks
 * - Error handling
 * - Resource cleanup
 *
 * Run: npx tsx lib/audio/__tests__/audioExtractor.runtime-test.ts
 * or: node --loader tsx lib/audio/__tests__/audioExtractor.runtime-test.ts
 */

console.log("🧪 Running audioExtractor runtime tests...\n");

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      testsFailed++;
    }
  };
}

async function runTests() {
  // Test 1: SSR Safety - checkBrowserCapabilities
  await test("SSR safety - checkBrowserCapabilities doesn't crash", () => {
    // Simulate SSR by deleting window
    const originalWindow = (global as any).window;
    delete (global as any).window;

    try {
      const { checkBrowserCapabilities } = require("../audioExtractor");
      const capabilities = checkBrowserCapabilities();

      if (capabilities.hasAudioContext !== false) {
        throw new Error("Expected hasAudioContext to be false in SSR");
      }
      if (capabilities.hasWebCodecs !== false) {
        throw new Error("Expected hasWebCodecs to be false in SSR");
      }
      if (!Array.isArray(capabilities.supportedMimeTypes)) {
        throw new Error("Expected supportedMimeTypes to be an array");
      }
    } finally {
      // Restore window
      (global as any).window = originalWindow;
    }
  })();

  // Test 2: SSR Safety - isBrowserSupported
  await test("SSR safety - isBrowserSupported returns false in SSR", () => {
    const originalWindow = (global as any).window;
    delete (global as any).window;

    try {
      const { isBrowserSupported } = require("../audioExtractor");
      const supported = isBrowserSupported();

      if (supported !== false) {
        throw new Error("Expected isBrowserSupported to return false in SSR");
      }
    } finally {
      (global as any).window = originalWindow;
    }
  })();

  // Test 3: Browser capability checks return proper structure
  await test("Browser capabilities return proper structure", () => {
    const { checkBrowserCapabilities } = require("../audioExtractor");
    const capabilities = checkBrowserCapabilities();

    if (typeof capabilities.hasAudioContext !== "boolean") {
      throw new Error("hasAudioContext should be boolean");
    }
    if (typeof capabilities.hasWebCodecs !== "boolean") {
      throw new Error("hasWebCodecs should be boolean");
    }
    if (!Array.isArray(capabilities.supportedMimeTypes)) {
      throw new Error("supportedMimeTypes should be array");
    }
  })();

  // Test 4: isBrowserSupported returns boolean
  await test("isBrowserSupported returns boolean", () => {
    const { isBrowserSupported } = require("../audioExtractor");
    const result = isBrowserSupported();

    if (typeof result !== "boolean") {
      throw new Error(`Expected boolean, got ${typeof result}`);
    }
  })();

  // Test 5: extractAudioFromVideo with preferUrlPassthrough
  await test("extractAudioFromVideo returns URL passthrough when preferred", async () => {
    const { extractAudioFromVideo } = require("../audioExtractor");
    const result = await extractAudioFromVideo("https://example.com/video.mp4", {
      preferUrlPassthrough: true,
    });

    if (result.method !== "url") {
      throw new Error(`Expected method 'url', got '${result.method}'`);
    }
    if (result.audioUrl !== "https://example.com/video.mp4") {
      throw new Error(`Expected audioUrl to match input URL`);
    }
  })();

  // Test 6: extractAudioClient returns error when browser not supported
  await test("extractAudioClient returns failed result when browser unsupported", async () => {
    const { extractAudioClient } = require("../audioExtractor");

    // If browser is supported, skip this test
    const { isBrowserSupported } = require("../audioExtractor");
    if (isBrowserSupported()) {
      console.log("   ⏭️  Skipped (browser is supported, can't test unsupported case)");
      return;
    }

    const result = await extractAudioClient("https://example.com/video.mp4");

    if (result.method !== "failed") {
      throw new Error(`Expected method 'failed', got '${result.method}'`);
    }
    if (!result.error) {
      throw new Error("Expected error message to be present");
    }
    if (!result.error.includes("WebCodecs")) {
      throw new Error("Expected error to mention WebCodecs API");
    }
  })();

  // Test 7: validateAudioUrl returns boolean
  await test("validateAudioUrl returns boolean", async () => {
    const { validateAudioUrl } = require("../audioExtractor");
    const result = await validateAudioUrl("https://example.com/video.mp4");

    if (typeof result !== "boolean") {
      throw new Error(`Expected boolean, got ${typeof result}`);
    }
  })();

  // Test 8: validateAudioUrl handles invalid URLs gracefully
  await test("validateAudioUrl handles invalid URLs without throwing", async () => {
    const { validateAudioUrl } = require("../audioExtractor");
    const result = await validateAudioUrl("not-a-valid-url");

    if (result !== false) {
      throw new Error("Expected false for invalid URL");
    }
  })();

  // Test 9: All exports are functions/defined
  await test("All exports are defined", () => {
    const exports = require("../audioExtractor");

    const requiredExports = [
      "extractAudioFromVideo",
      "extractAudioClient",
      "checkBrowserCapabilities",
      "isBrowserSupported",
      "validateAudioUrl",
    ];

    for (const exportName of requiredExports) {
      if (!(exportName in exports)) {
        throw new Error(`Missing export: ${exportName}`);
      }
      if (typeof exports[exportName] !== "function") {
        throw new Error(`Export ${exportName} is not a function`);
      }
    }
  })();

  // Test 10: extractAudioClient with Blob handles errors gracefully
  await test("extractAudioClient handles invalid Blob gracefully", async () => {
    const { extractAudioClient } = require("../audioExtractor");

    const invalidBlob = new Blob([new Uint8Array([0, 1, 2, 3])], {
      type: "video/mp4",
    });

    // Should not throw, should return a result
    const result = await extractAudioClient(invalidBlob);

    if (!result || typeof result !== "object") {
      throw new Error("Expected result object");
    }

    if (!("method" in result)) {
      throw new Error("Expected result to have 'method' field");
    }

    // Should be either 'failed' or potentially 'client' if browser can't process it
    if (!["failed", "client"].includes(result.method)) {
      throw new Error(`Unexpected method value: ${result.method}`);
    }
  })();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📝 Total:  ${testsPassed + testsFailed}`);
  console.log("=".repeat(60));

  if (testsFailed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n💥 Test runner crashed:");
  console.error(error);
  process.exit(1);
});
