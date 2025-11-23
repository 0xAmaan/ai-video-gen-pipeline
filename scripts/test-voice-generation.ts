/**
 * Test script for voice generation feature
 * Run with: npx tsx scripts/test-voice-generation.ts
 */

import { getVoiceAdapter } from "../lib/audio-provider-factory";
import { AUDIO_MODELS } from "../lib/audio-models";

async function testVoiceGeneration() {
  console.log("🧪 Testing Voice Generation Feature\n");

  // Test 1: Verify audio models configuration
  console.log("📋 Test 1: Audio Models Configuration");
  console.log("=====================================");
  
  const testModels = [
    "replicate-minimax-turbo",
    "replicate-minimax-tts",
    "bark-voice",
    "elevenlabs-multilingual-v2",
  ];

  for (const modelKey of testModels) {
    const model = AUDIO_MODELS[modelKey];
    if (model) {
      console.log(`✅ ${modelKey}:`);
      console.log(`   - Name: ${model.name}`);
      console.log(`   - Vendor: ${model.vendor}`);
      console.log(`   - Latency: ${model.latencySeconds}s`);
      console.log(`   - Cost: $${model.estimatedCost} ${model.costUnit}`);
    } else {
      console.log(`❌ ${modelKey}: NOT FOUND`);
    }
  }

  // Test 2: Verify adapter instantiation
  console.log("\n📦 Test 2: Adapter Instantiation");
  console.log("=================================");

  try {
    const replicateAdapter = getVoiceAdapter({
      vendor: "replicate",
      modelKey: "replicate-minimax-turbo",
    });
    console.log(`✅ Replicate adapter: ${replicateAdapter.vendor} (${replicateAdapter.providerKey})`);

    const elevenlabsAdapter = getVoiceAdapter({
      vendor: "elevenlabs",
      modelKey: "elevenlabs-multilingual-v2",
    });
    console.log(`✅ ElevenLabs adapter: ${elevenlabsAdapter.vendor} (${elevenlabsAdapter.providerKey})`);
  } catch (error) {
    console.error(`❌ Adapter error: ${error instanceof Error ? error.message : error}`);
  }

  // Test 3: Check environment variables
  console.log("\n🔑 Test 3: Environment Variables");
  console.log("==================================");
  
  // pragma: allowlist secret
  const requiredEnvVars = [
    "REPLICATE_API_KEY",
    "ELEVENLABS_API_KEY",
  ];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: Set (hidden)`);
    } else {
      console.log(`⚠️  ${envVar}: Not set (optional for testing)`);
    }
  }

  // Test 4: Simulate API request validation
  console.log("\n🔍 Test 4: API Request Validation");
  console.log("===================================");

  const testRequests = [
    { text: "", valid: false, reason: "Empty text" },
    { text: "Hello world", valid: true, reason: "Valid text" },
    { text: "A".repeat(10000), valid: true, reason: "Long text (should add validation)" },
    { ssml: "<speak>Hello</speak>", valid: true, reason: "Valid SSML" },
  ];

  for (const req of testRequests) {
    const hasText = req.text && req.text.trim().length > 0;
    const hasSsml = req.ssml && req.ssml.trim().length > 0;
    const isValid = hasText || hasSsml;
    
    if (req.valid === isValid) {
      console.log(`✅ ${req.reason}: Validation correct`);
    } else {
      console.log(`❌ ${req.reason}: Validation incorrect (expected ${req.valid}, got ${isValid})`);
    }
  }

  // Test 5: Asset metadata structure
  console.log("\n📄 Test 5: Asset Metadata Structure");
  console.log("====================================");

  const sampleAsset = {
    id: crypto.randomUUID?.() ?? "test-id",
    name: "Voice Test.wav",
    type: "audio" as const,
    url: "data:audio/wav;base64,test",
    duration: 5,
    waveform: undefined,
    sampleRate: 44100,
    width: 0,
    height: 0,
    fps: 0,
  };

  console.log("Sample asset structure:");
  console.log(JSON.stringify(sampleAsset, null, 2));

  // Verify required fields
  const requiredFields = ["id", "name", "type", "url", "duration", "width", "height", "fps"];
  const missingFields = requiredFields.filter(field => !(field in sampleAsset));
  
  if (missingFields.length === 0) {
    console.log("✅ All required fields present");
  } else {
    console.log(`❌ Missing fields: ${missingFields.join(", ")}`);
  }

  // Test 6: Word count and duration estimation
  console.log("\n⏱️  Test 6: Duration Estimation");
  console.log("================================");

  const testTexts = [
    { text: "Hello world", expectedWords: 2 },
    { text: "This is a longer test sentence with multiple words.", expectedWords: 9 },
    { text: "  Whitespace   handling   test  ", expectedWords: 3 },
  ];

  for (const { text, expectedWords } of testTexts) {
    const words = text.trim().split(/\s+/).filter(w => w).length;
    const duration = Math.max(1, Math.round(words / 2.6));
    
    if (words === expectedWords) {
      console.log(`✅ "${text.substring(0, 30)}...": ${words} words, ~${duration}s`);
    } else {
      console.log(`❌ Word count mismatch: expected ${expectedWords}, got ${words}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ All tests completed!");
  console.log("=".repeat(50));
}

// Run tests
testVoiceGeneration().catch(error => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
