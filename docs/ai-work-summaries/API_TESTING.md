# API Testing Guide: Scene Generation Endpoint

## Endpoint Details

**URL:** `POST /api/project-redesign/generate-scenes`

**Purpose:** Generate AI-powered scene and shot breakdowns from user braindump text

## Request Format

```typescript
{
  projectId: string,           // Required: Convex project ID
  userInput: string,           // Required: User's creative input (min 10 chars)
  projectTitle?: string,       // Optional: Project name for context
  projectDescription?: string  // Optional: Additional project context
}
```

## Response Format

```typescript
{
  success: boolean,
  scenes: Array<{
    sceneNumber: number,
    title: string,
    description: string,
    shots: Array<{
      shotNumber: number,
      description: string,
      initialPrompt: string  // Optimized for image generation
    }>
  }>,
  createdSceneIds: string[],   // Convex IDs of created scenes
  message: string
}
```

## Testing Scenarios

### Test 1: Vague Concept Input
**Input:**
```json
{
  "projectId": "your-project-id",
  "userInput": "A video about climate change and how technology can help solve it",
  "projectTitle": "Tech for Climate"
}
```

**Expected Behavior:**
- AI generates 3-8 complete scenes from scratch
- Each scene has 2-5 shots
- Prompts are cinematic and detailed
- Narrative flows logically

---

### Test 2: Specific Scene List
**Input:**
```json
{
  "projectId": "your-project-id",
  "userInput": "1. Opening shot of a polluted city\n2. Scientists working in a lab on clean energy\n3. Solar panels being installed\n4. Clean city transformation",
  "projectTitle": "Clean Energy Revolution"
}
```

**Expected Behavior:**
- AI expands each item into a full scene
- Adds multiple shots per scene
- Maintains user's scene order
- Enhances descriptions with visual details

---

### Test 3: Detailed Breakdown
**Input:**
```json
{
  "projectId": "your-project-id",
  "userInput": "Scene 1: Aerial view of city at dawn, smog visible in golden hour light. Then cut to close-up of factory smokestacks. Scene 2: Inside a modern lab, scientists analyze data on large screens. Wide shot of the full lab space.",
  "projectTitle": "Environmental Impact Study"
}
```

**Expected Behavior:**
- AI preserves detailed user input
- Structures into formal scenes/shots
- Adds image generation optimizations
- Maintains specific visual details mentioned

---

### Test 4: Abstract Creative Brief
**Input:**
```json
{
  "projectId": "your-project-id",
  "userInput": "Show the journey of innovation - from struggle to breakthrough. Make it feel inspiring and cinematic. Should work for a tech startup video.",
  "projectTitle": "Innovation Journey",
  "projectDescription": "Corporate video for tech startup showcasing their product development process"
}
```

**Expected Behavior:**
- AI interprets abstract concepts into concrete visuals
- Creates metaphorical and literal shots
- Balances creative direction with practical implementation
- Uses context from title and description

---

## Manual Testing with cURL

```bash
curl -X POST http://localhost:3000/api/project-redesign/generate-scenes \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_ID",
    "userInput": "A video about the future of AI",
    "projectTitle": "AI Tomorrow"
  }'
```

## Demo Mode Testing

To test without API keys or Convex, add demo mode header:

```bash
curl -X POST http://localhost:3000/api/project-redesign/generate-scenes \
  -H "Content-Type: application/json" \
  -H "X-Demo-Mode: true" \
  -d '{
    "projectId": "demo-project-id",
    "userInput": "Test input"
  }'
```

This returns mock data without making external API calls.

---

## Expected Performance

- **Generation Time:** 3-10 seconds (depends on scene complexity)
- **Cost:** ~$0.01-0.03 per generation (GPT-4o pricing)
- **Scene Range:** 2-10 scenes (typically 3-6)
- **Shots per Scene:** 2-6 (typically 3-4)

---

## Error Scenarios to Test

### 1. Missing API Key
**Setup:** Remove `OPENAI_API_KEY` from `.env.local`
**Expected:** 500 error with helpful message about missing key

### 2. Invalid Project ID
**Input:** `projectId: "invalid-id"`
**Expected:** Convex mutation fails gracefully, partial scenes may be created

### 3. Too Short Input
**Input:** `userInput: "short"`
**Expected:** 400 error: "userInput is required and must be at least 10 characters"

### 4. Rate Limit Hit
**Setup:** Make many rapid requests
**Expected:** 429 error with retry message

---

## Integration with Frontend

When calling from your project creation page:

```typescript
const generateScenes = async (userBraindump: string) => {
  try {
    const response = await fetch('/api/project-redesign/generate-scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: project._id,
        userInput: userBraindump,
        projectTitle: project.title,
        projectDescription: project.description,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Scenes are already persisted to Convex
      // Navigate to scene planner or show success message
      router.push(`/project-redesign/${project._id}/scene-planner`);
    } else {
      // Handle error
      console.error('Scene generation failed:', data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

---

## Success Criteria

✅ Endpoint responds within 10 seconds
✅ Generated scenes have coherent narrative flow
✅ Shot prompts are detailed and image-generation ready
✅ Scenes are successfully persisted to Convex
✅ Error handling is graceful with helpful messages
✅ Demo mode works without external dependencies
✅ Adapts to different input detail levels (vague → detailed)

---

## Verification Checklist

After running a test:

1. ✅ Check Convex dashboard - scenes should appear in `projectScenes` table
2. ✅ Check Convex dashboard - shots should appear in `sceneShots` table
3. ✅ Navigate to scene planner page - scenes should render correctly
4. ✅ Verify scene/shot numbering is sequential
5. ✅ Check that `initialPrompt` fields are suitable for image generation
6. ✅ Confirm scene titles are concise and descriptive
7. ✅ Validate narrative coherence across all scenes

---

## Notes

- The endpoint uses **GPT-4o** for better creative reasoning (vs gpt-4o-mini)
- System prompt optimizes for **cinematic visual descriptions**
- Prompts are designed to work with **Nano Banana** image model (used in shot iterator)
- Schema validation ensures consistent output structure
- Convex mutations happen sequentially to maintain referential integrity
