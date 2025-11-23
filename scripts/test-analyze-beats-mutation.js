/**
 * Test Script for analyzeBeatsMutation
 *
 * Tests the new public mutation that triggers beat analysis
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.CONVEX_URL || "https://third-finch-240.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function testAnalyzeBeatsMutation() {
  console.log("🧪 Testing analyzeBeatsMutation\n");
  console.log("Convex URL:", CONVEX_URL);

  try {
    // First, let's list some audio assets to find one to test with
    console.log("\n📋 Fetching audio assets...");

    // We'll need to query for audio assets
    // For now, let's create a test asset
    console.log("\n🎵 Creating test audio asset...");

    // Note: This requires a mutation to create assets
    // For this test, we'll assume an asset already exists
    // You can manually create one in the Convex dashboard first

    console.log("\n⚠️  Manual Test Steps:");
    console.log("1. Go to Convex Dashboard: https://dashboard.convex.dev");
    console.log("2. Navigate to your 'audioAssets' table");
    console.log("3. Find an asset ID or create a test asset with:");
    console.log("   - type: 'bgm'");
    console.log("   - source: 'uploaded'");
    console.log("   - url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'");
    console.log("   - projectId: (any valid project ID)");
    console.log("   - beatAnalysisStatus: 'not_analyzed'");
    console.log("4. Copy the asset ID");
    console.log("5. Run this script with: ASSET_ID=<id> node scripts/test-analyze-beats-mutation.js");
    console.log("");

    const assetId = process.env.ASSET_ID;

    if (!assetId) {
      console.log("❌ No ASSET_ID provided. Please follow the manual steps above.");
      return;
    }

    console.log("\n🚀 Triggering beat analysis for asset:", assetId);

    // Call the mutation
    await client.mutation(api.beatAnalysis.analyzeBeatsMutation, {
      assetId: assetId,
    });

    console.log("✅ Mutation called successfully!");
    console.log("\n📊 Check Convex logs to see the analysis progress:");
    console.log("   https://dashboard.convex.dev");
    console.log("\nThe analysis will:");
    console.log("1. Set beatAnalysisStatus to 'analyzing'");
    console.log("2. Schedule the performAnalysis action");
    console.log("3. Call Replicate API (may take 30-60 seconds)");
    console.log("4. Save results or mark as failed");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\nFull error:", error);
  }
}

// Run the test
testAnalyzeBeatsMutation().catch(console.error);
