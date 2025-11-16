/**
 * Test script to verify model selection decision tree
 * Run with: node test-model-selection.js
 */

// Simplified version of selectImageModel logic
const IMAGE_MODELS = {
  "flux-schnell": { name: "FLUX.1 Schnell" },
  "flux-pro": { name: "FLUX.1 Pro" },
  "sdxl-lightning": { name: "SDXL Lightning" },
  "hidream-i1": { name: "HiDream-I1" },
  "flux-pro-ultra": { name: "FLUX.1 Pro Ultra" },
};

const DEFAULT_IMAGE_MODEL = "flux-schnell";

function selectImageModel(responses) {
  if (!responses) {
    return DEFAULT_IMAGE_MODEL;
  }

  // Priority 1: Explicit model selection
  if (responses["image-model"]) {
    const modelKey = responses["image-model"];
    if (IMAGE_MODELS[modelKey]) {
      return modelKey;
    }
  }

  // Priority 2: Explicit image generation priority
  if (responses["image-generation-priority"]) {
    const priorityMapping = {
      speed: "flux-schnell",
      "text-quality": "flux-pro",
      photorealism: "sdxl-lightning",
      artistic: "hidream-i1",
      professional: "flux-pro-ultra",
    };
    const modelKey = priorityMapping[responses["image-generation-priority"]];
    if (modelKey) {
      return modelKey;
    }
  }

  // Priority 3: Infer from visual style
  const visualStyle = responses["visual-style"];
  if (visualStyle) {
    const styleMapping = {
      photorealistic: "sdxl-lightning",
      "photo-realistic": "sdxl-lightning",
      realistic: "sdxl-lightning",
      cinematic: "flux-pro",
      artistic: "hidream-i1",
      creative: "hidream-i1",
      stylized: "hidream-i1",
      "vector-art": "flux-schnell",
      illustrated: "hidream-i1",
      modern: "flux-pro",
      professional: "flux-pro",
    };
    const modelKey = styleMapping[visualStyle.toLowerCase()];
    if (modelKey) {
      return modelKey;
    }
  }

  // Priority 4: Check if text/logos are critical
  const includesText = responses["includes-text"];
  if (includesText === "yes") {
    return "flux-pro";
  }

  // Priority 5: Check pacing
  const pacing = responses["pacing"];
  if (pacing === "fast" || pacing === "quick" || pacing === "dynamic") {
    return "flux-schnell";
  }

  // Priority 6: Check quality preference
  const quality = responses["quality-preference"];
  if (quality === "maximum" || quality === "premium" || quality === "best") {
    return "flux-pro-ultra";
  }

  // Priority 7: Check emotion/mood
  const emotion = responses["primary-emotion"] || responses["emotion"];
  const artisticEmotions = [
    "dreamy",
    "surreal",
    "whimsical",
    "mysterious",
    "ethereal",
    "melancholic",
  ];
  if (emotion && artisticEmotions.includes(emotion.toLowerCase())) {
    return "hidream-i1";
  }

  // Default
  return DEFAULT_IMAGE_MODEL;
}

// Test cases
const testCases = [
  {
    name: "No responses (should default to flux-schnell)",
    responses: undefined,
    expected: "flux-schnell",
  },
  {
    name: "Empty responses (should default to flux-schnell)",
    responses: {},
    expected: "flux-schnell",
  },
  {
    name: "Explicit image-generation-priority: text-quality",
    responses: {
      "image-generation-priority": "text-quality",
      "visual-style": "modern",
    },
    expected: "flux-pro",
  },
  {
    name: "Explicit image-generation-priority: speed",
    responses: {
      "image-generation-priority": "speed",
    },
    expected: "flux-schnell",
  },
  {
    name: "Explicit image-generation-priority: photorealism",
    responses: {
      "image-generation-priority": "photorealism",
    },
    expected: "sdxl-lightning",
  },
  {
    name: "Explicit image-generation-priority: artistic",
    responses: {
      "image-generation-priority": "artistic",
    },
    expected: "hidream-i1",
  },
  {
    name: "Visual style: photorealistic (no priority question)",
    responses: {
      "visual-style": "photorealistic",
      "primary-emotion": "inspired",
    },
    expected: "sdxl-lightning",
  },
  {
    name: "Visual style: artistic",
    responses: {
      "visual-style": "artistic",
    },
    expected: "hidream-i1",
  },
  {
    name: "Visual style: modern",
    responses: {
      "visual-style": "modern",
    },
    expected: "flux-pro",
  },
  {
    name: "Includes text (no other indicators)",
    responses: {
      "includes-text": "yes",
      "primary-emotion": "professional",
    },
    expected: "flux-pro",
  },
  {
    name: "Fast pacing (no other indicators)",
    responses: {
      "pacing": "fast",
    },
    expected: "flux-schnell",
  },
  {
    name: "Dreamy emotion (should pick hidream)",
    responses: {
      "primary-emotion": "dreamy",
    },
    expected: "hidream-i1",
  },
  {
    name: "Quality: maximum",
    responses: {
      "quality-preference": "maximum",
    },
    expected: "flux-pro-ultra",
  },
  {
    name: "Priority overrides visual-style",
    responses: {
      "image-generation-priority": "speed",
      "visual-style": "photorealistic", // This should be ignored
    },
    expected: "flux-schnell", // Priority wins
  },
];

console.log("🧪 Testing Model Selection Decision Tree\n");
console.log("=".repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = selectImageModel(test.responses);
  const success = result === test.expected;

  if (success) {
    passed++;
    console.log(`\n✅ Test ${index + 1}: ${test.name}`);
    console.log(`   Expected: ${test.expected} (${IMAGE_MODELS[test.expected].name})`);
    console.log(`   Got:      ${result} (${IMAGE_MODELS[result].name})`);
  } else {
    failed++;
    console.log(`\n❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Expected: ${test.expected} (${IMAGE_MODELS[test.expected].name})`);
    console.log(`   Got:      ${result} (${IMAGE_MODELS[result].name})`);
  }

  if (test.responses) {
    console.log(`   Responses: ${JSON.stringify(test.responses)}`);
  }
});

console.log("\n" + "=".repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${testCases.length} total)\n`);

if (failed === 0) {
  console.log("🎉 All tests passed! Decision tree is working correctly.\n");
  process.exit(0);
} else {
  console.log("⚠️  Some tests failed. Check the logic in select-image-model.ts\n");
  process.exit(1);
}
