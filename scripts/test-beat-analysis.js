/**
 * Manual Testing Guide for Beat Analysis Replicate Integration
 *
 * This guide explains how to test the beat analysis functionality
 * since internal actions cannot be called directly from client code.
 */

console.log("🎵 Beat Analysis Testing Guide\n");
console.log("=".repeat(60));
console.log("\n📝 Manual Test Steps:\n");

console.log("1. Go to Convex Dashboard:");
console.log("   https://dashboard.convex.dev\n");

console.log("2. Navigate to your deployment");
console.log("   (third-finch-240)\n");

console.log("3. Go to 'Functions' tab\n");

console.log("4. Find and click 'beatAnalysis:performAnalysis'\n");

console.log("5. Create a test audio asset first:");
console.log("   - Go to Tables > audioAssets");
console.log("   - Insert a document with:");
console.log("     {");
console.log('       "projectId": "<valid_project_id>",');
console.log('       "type": "bgm",');
console.log('       "source": "external",');
console.log('       "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",');
console.log('       "beatAnalysisStatus": "not_analyzed",');
console.log('       "createdAt": Date.now(),');
console.log('       "updatedAt": Date.now()');
console.log("     }\n");

console.log("6. Copy the generated asset ID\n");

console.log("7. Test the performAnalysis action with:");
console.log("   {");
console.log('     "assetId": "<paste_asset_id_here>",');
console.log('     "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"');
console.log("   }\n");

console.log("8. Wait 30-60 seconds for Replicate API to complete\n");

console.log("9. Check results:");
console.log("   - Logs tab: View processing logs");
console.log("   - Tables > audioAssets: See beatMarkers and bpm fields\n");

console.log("Expected Results:");
console.log("   ✅ Status: 'completed'");
console.log("   ✅ BPM: ~136");
console.log("   ✅ Beat Count: ~700-800 beats");
console.log("   ✅ Analysis Method: 'replicate'\n");

console.log("=".repeat(60));
console.log("\n📚 See test-beat-analysis-example.js for automated testing example\n");
