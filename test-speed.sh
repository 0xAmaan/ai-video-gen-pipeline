#!/bin/bash

# Speed test script for comparing API approaches
# Make sure your dev server is running (bun run dev)

echo "🚀 Starting speed test..."
echo ""

curl -X POST http://localhost:3000/api/test-speed \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A quick product demo video showing a modern mobile app",
    "responses": {
      "visual-style": "modern",
      "pacing": "dynamic",
      "image-generation-priority": "speed"
    }
  }' | jq '.'

echo ""
echo "✅ Test complete! Check the console logs above for detailed timing breakdown."
