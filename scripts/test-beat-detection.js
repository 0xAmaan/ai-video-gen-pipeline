/**
 * Simple verification script for client-side beat detection
 * Tests that the module can be imported and basic functionality works
 */

async function testBeatDetection() {
  try {
    console.log("Testing client-side beat detection...\n");

    // Test 1: Import the module
    console.log("1. Testing module import...");
    const module = await import("../lib/audio/clientBeatDetection.ts");
    console.log("   ✓ Module imported successfully");
    console.log(`   Exports: ${Object.keys(module).join(", ")}\n`);

    // Test 2: Check exports
    console.log("2. Checking exports...");
    const detectBeatsClientSide = module.detectBeatsClientSide || module.default?.detectBeatsClientSide;
    const detectBeatsFromVideo = module.detectBeatsFromVideo || module.default?.detectBeatsFromVideo;
    const isClientBeatDetectionSupported = module.isClientBeatDetectionSupported || module.default?.isClientBeatDetectionSupported;

    if (typeof detectBeatsClientSide !== "function") {
      throw new Error("detectBeatsClientSide is not a function");
    }
    console.log("   ✓ detectBeatsClientSide is a function");

    if (typeof isClientBeatDetectionSupported !== "function") {
      throw new Error("isClientBeatDetectionSupported is not a function");
    }
    console.log("   ✓ isClientBeatDetectionSupported is a function");

    if (typeof detectBeatsFromVideo !== "function") {
      throw new Error("detectBeatsFromVideo is not a function");
    }
    console.log("   ✓ detectBeatsFromVideo is a function (NEW integration helper)\n");

    // Test 3: Check browser support (will be false in Node.js)
    console.log("3. Testing browser support check...");
    const isSupported = isClientBeatDetectionSupported();
    console.log(`   Browser supported: ${isSupported}`);
    console.log(
      "   (Expected: false in Node.js environment, true in browser)\n"
    );

    // Test 4: Test error handling with invalid input
    console.log("4. Testing error handling with invalid input...");
    const errorResult = await detectBeatsClientSide(null);
    if (errorResult.error) {
      console.log(`   ✓ Error handled gracefully: "${errorResult.error}"`);
    } else {
      throw new Error("Expected error for null input");
    }
    console.log(`   Response structure: ${JSON.stringify(errorResult, null, 2)}\n`);

    console.log("✅ All verification tests passed!");
    console.log("\nSummary:");
    console.log("- Module imports correctly");
    console.log("- All functions exported and callable");
    console.log("- detectBeatsFromVideo integration helper available");
    console.log("- Error handling works as expected");
    console.log("- Ready for browser-based testing with real AudioBuffer");
    console.log("\nNew in this version:");
    console.log("- detectBeatsFromVideo() for seamless video-to-beats workflow");
    console.log("- Fixed AudioContext resource leaks in tests");
    console.log("- Updated documentation with correct usage examples");
  } catch (error) {
    console.error("❌ Verification failed:");
    console.error(error);
    process.exit(1);
  }
}

testBeatDetection();
