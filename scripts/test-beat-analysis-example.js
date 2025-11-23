/**
 * Run beat analysis test with real audio file
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "https://third-finch-240.convex.cloud";

// Public test audio file (30-second music sample)
const TEST_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

async function main() {
  console.log("🎵 Testing Beat Analysis with Real Audio\n");
  console.log(`Convex URL: ${CONVEX_URL}`);
  console.log(`Test Audio: ${TEST_AUDIO_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    console.log("⏳ Calling beat analysis (this may take 30-60 seconds)...\n");

    const startTime = Date.now();

    const results = await client.action(api.testBeatAnalysis.testWithRealAudio, {
      audioUrl: TEST_AUDIO_URL,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Test completed in ${duration}s\n`);
    console.log("📊 Results:");
    console.log(`   Status: ${results.status}`);
    console.log(`   BPM: ${results.bpm || 'N/A'}`);
    console.log(`   Beat Count: ${results.beatCount}`);
    console.log(`   Analysis Method: ${results.analysisMethod || 'N/A'}`);

    if (results.error) {
      console.log(`   ❌ Error: ${results.error}`);
    }

    if (results.beatMarkers && results.beatMarkers.length > 0) {
      console.log(`\n   First 10 beat markers:`);
      results.beatMarkers.forEach((marker, i) => {
        const type = marker.isDownbeat ? "DOWNBEAT" : "beat";
        console.log(`     ${i + 1}. ${marker.time.toFixed(3)}s - ${type} (strength: ${marker.strength})`);
      });
    }

    console.log("\n✅ Beat analysis test successful!");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    if (error.data) {
      console.error("   Details:", error.data);
    }
    process.exit(1);
  }
}

main();
