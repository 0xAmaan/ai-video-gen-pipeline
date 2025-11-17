# Model Selection + Pipeline Update

We want to easily use different models for development testing during different steps of our pipeline. Make sure ALL the selection model selection elements can be toggled on and off through the flip of ONE feature toggle. This task requires adding an easy to use UI element at each step where we use LLM models, with a drop down, where each model says its name, its speed, and its cost (all have to be in the same scale relative to each other). NOTE: IF YOU DON’T KNOW THE SPEED AND/OR COST, DO NOT GUESS IT - JUST PUT A PLACEHOLDER IN. Also, put the UI elements in LOGICAL places - like have the dropdown BEFORE you’re using the models! Use context7 mcp to check documentation.

---

# Current Pipeline (To Be Updated)

## Step 1: Text → Text (User Prompt → Clarifying Questions)

**Location:**
`app/api/generate-questions/route.ts:70-76`

**Models Used (NOW EXPANDED):**

* Primary: Groq `"openai/gpt-oss-20b"` (FAST ⚡)
* Fallback: OpenAI `"gpt-4o-mini"` (SLOWER 🐌)
* **Additional OpenAI Options to Add to Dropdown:**

  * `gpt-5-nano-2025-08-07`
  * `gpt-5-mini-2025-08-07`
  * `gpt-4.1-mini-2025-04-14`

**API Call:**

```ts
const result = await generateObject({
  model: groq("openai/gpt-oss-20b"),
  schema: questionSchema,
  system: QUESTION_GENERATION_SYSTEM_PROMPT,
  prompt: buildQuestionGenerationPrompt(prompt),
  maxRetries: 2,
});
```

**Purpose:**
Generates 3–5 clarifying questions to refine the user's video concept, including a mandatory question about image generation priorities.

---

## Step 2: Text → Image + Script (Story Generation)

**Location:**
`app/api/generate-storyboard/route.ts:71-77`
`app/api/generate-storyboard/route.ts:133-146`

---

### Part A: Scene Description Generation (Text → Text)

**Models Used (NOW EXPANDED):**

* Primary: Groq `"openai/gpt-oss-20b"` (FAST ⚡)
* Fallback: OpenAI `"gpt-4o-mini"` (SLOWER 🐌)
* **Additional OpenAI Options to Add to Dropdown:**

  * `gpt-5-nano-2025-08-07`
  * `gpt-5-mini-2025-08-07`
  * `gpt-4.1-mini-2025-04-14`

**API Call:**

```ts
const { object: sceneData } = await generateObject({
  model: modelToUse,
  schema: sceneSchema,
  system: STORYBOARD_SYSTEM_PROMPT,
  prompt: buildStoryboardPrompt(prompt, responses),
  maxRetries: 3,
});
```

**Purpose:**
Breaks down the video concept into 3–5 scenes with detailed visual prompts (150–250+ words each) optimized for AI image generation.

---

### Part B: Image Generation (Text → Image)

**Model Used:**
Leonardo Phoenix 1.0 via Replicate

**Location:**
`app/api/generate-storyboard/route.ts:133-146`

**API Call:**

```ts
const output = await replicate.run(modelConfig.id as `${string}/${string}`, {
  input: {
    prompt: scene.visualPrompt,
    aspect_ratio: "16:9",
    generation_mode: "quality",
    contrast: "medium",
    num_images: 1,
    prompt_enhance: false,
    style: phoenixStyle,
  }
});
```

**Purpose:**
Generates cinematic-quality storyboard images for each scene using the detailed visual prompts.

**Style Selection:**
cinematic, documentary/B&W, photography, illustration, vintage, portrait styles.

**Cost:**
~$0.032 per image

**NEW REQUIREMENT:**
Add all models located in:
`/Users/yibin/Documents/WORKZONE/VSCODE/GAUNTLET_AI/6_Week/ai-video-gen-pipeline/lib/image-models.ts`
into the dropdown selection.

---

## Step 3: Image + Script → Video Generation

**Location:**
`app/api/generate-video-clip/route.ts:34-43`

**Current Model Used:**
WAN 2.5 Image-to-Video Fast via Replicate

**API Call Template (Use This Format for All Models):**
*(If a model supports more parameters, keep their defaults. Only ensure we pass `image` and `prompt`.)*

```ts
const output = await replicate.run("wan-video/wan-2.5-i2v-fast", {
  input: {
    image: imageUrl,
    prompt: prompt + ", cinematic, smooth motion, professional",
    duration: duration,
    resolution: resolution,
    negative_prompt: "blur, distortion, jitter, artifacts, low quality",
    prompt_expansion: true,
  },
});
```

**Purpose:**
Converts each storyboard image into a video clip with smooth motion, cinematic quality, and professional motion dynamics.

**Parameters:**

* Duration: Configurable (default 5 seconds)
* Resolution: Configurable (default 720p)
* Prompt Enhancement: Enabled

---

# Additional Video Models to Add to Dropdown

For ALL of these, use the **WAN-style input template above**, and **pass only `image` and `prompt`**, unless parameters are required. If a model has defaults, let them stay default.

---

## bytedance/seedance-1-lite — INPUT:

```json
{ "type":"object","title":"Input","required":["prompt"],"properties":{
"fps":{"enum":[24],"type":"integer","title":"fps","description":"Frame rate (frames per second)","default":24,"x-order":7},
"seed":{"type":"integer","title":"Seed","x-order":9,"nullable":true,"description":"Random seed. Set for reproducible generation"},
"image":{"type":"string","title":"Image","format":"uri","x-order":1,"nullable":true,"description":"Input image for image-to-video generation"},
"prompt":{"type":"string","title":"Prompt","x-order":0,"description":"Text prompt for video generation"},
"duration":{"type":"integer","title":"Duration","default":5,"maximum":12,"minimum":2,"x-order":4,"description":"Video duration in seconds"},
"resolution":{"enum":["480p","720p","1080p"],"type":"string","title":"resolution","description":"Video resolution","default":"720p","x-order":5},
"aspect_ratio":{"enum":["16:9","4:3","1:1","3:4","9:16","21:9","9:21"],"type":"string","title":"aspect_ratio","description":"Video aspect ratio. Ignored if an image is used.","default":"16:9","x-order":6},
"camera_fixed":{"type":"boolean","title":"Camera Fixed","default":false,"x-order":8,"description":"Whether to fix camera position"},
"last_frame_image":{"type":"string","title":"Last Frame Image","format":"uri","x-order":2,"nullable":true,"description":"Input image for last frame generation. This only works if an image start frame is given too."},
"reference_images":{"type":"array","items":{"type":"string","anyOf":[],"format":"uri"},"title":"Reference Images","x-order":3,"nullable":true,"description":"Reference images (1-4 images) to guide video generation for characters, avatars, clothing, environments, or multi-character interactions. Reference images cannot be used with 1080p resolution or first frame or last frame images."}
}}
```

---

## google/veo-3.1 — INPUT:

```json
{ "type":"object","title":"Input","required":["prompt"],"properties":{
"seed":{"type":"integer","title":"Seed","x-order":9,"nullable":true,"description":"Random seed. Omit for random generations"},
"image":{"type":"string","title":"Image","format":"uri","x-order":3,"nullable":true,"description":"Input image to start generating from. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose."},
"prompt":{"type":"string","title":"Prompt","x-order":0,"description":"Text prompt for video generation"},
"duration":{"enum":[4,6,8],"type":"integer","title":"duration","description":"Video duration in seconds","default":8,"x-order":2},
"last_frame":{"type":"string","title":"Last Frame","format":"uri","x-order":4,"nullable":true,"description":"Ending image for interpolation. When provided with an input image, creates a transition between the two images."},
"resolution":{"enum":["720p","1080p"],"type":"string","title":"resolution","description":"Resolution of the generated video","default":"1080p","x-order":7},
"aspect_ratio":{"enum":["16:9","9:16"],"type":"string","title":"aspect_ratio","description":"Video aspect ratio","default":"16:9","x-order":1},
"generate_audio":{"type":"boolean","title":"Generate Audio","default":true,"x-order":8,"description":"Generate audio with the video"},
"negative_prompt":{"type":"string","title":"Negative Prompt","x-order":6,"nullable":true,"description":"Description of what to exclude from the generated video"},
"reference_images":{"type":"array","items":{"type":"string","format":"uri"},"title":"Reference Images","default":[],"x-order":5,"description":"1 to 3 reference images for subject-consistent generation (reference-to-video, or R2V). Reference images only work with 16:9 aspect ratio and 8-second duration. Last frame is ignored if reference images are provided."}
}}
```

---

## google/veo-3.1-fast — INPUT:

```json
{ "type":"object","title":"Input","required":["prompt"],"properties":{
"seed":{"type":"integer","title":"Seed","x-order":8,"nullable":true,"description":"Random seed. Omit for random generations"},
"image":{"type":"string","title":"Image","format":"uri","x-order":3,"nullable":true,"description":"Input image to start generating from. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose."},
"prompt":{"type":"string","title":"Prompt","x-order":0,"description":"Text prompt for video generation"},
"duration":{"enum":[4,6,8],"type":"integer","title":"duration","description":"Video duration in seconds","default":8,"x-order":2},
"last_frame":{"type":"string","title":"Last Frame","format":"uri","x-order":4,"nullable":true,"description":"Ending image for interpolation. When provided with an input image, creates a transition between the two images."},
"resolution":{"enum":["720p","1080p"],"type":"string","title":"resolution","description":"Resolution of the generated video","default":"1080p","x-order":6},
"aspect_ratio":{"enum":["16:9","9:16"],"type":"string","title":"aspect_ratio","description":"Video aspect ratio","default":"16:9","x-order":1},
"generate_audio":{"type":"boolean","title":"Generate Audio","default":true,"x-order":7,"description":"Generate audio with the video"},
"negative_prompt":{"type":"string","title":"Negative Prompt","x-order":5,"nullable":true,"description":"Description of what to exclude from the generated video"}
}}
```

---

## minimax/hailuo-2.3-fast — INPUT:

```json
{ "type":"object","title":"Input","required":["prompt","first_frame_image"],"properties":{
"prompt":{"type":"string","title":"Prompt","description":"Text prompt for generation"},
"duration":{"enum":[6,10],"type":"integer","title":"duration","description":"Duration of the video in seconds. 10 seconds is only available for 768p resolution.","default":6,"x-order":2},
"resolution":{"enum":["768p","1080p"],"type":"string","title":"resolution","description":"Pick between 768p or 1080p resolution. 1080p supports only 6-second duration.","default":"768p","x-order":3},
"prompt_optimizer":{"type":"boolean","title":"Prompt Optimizer","default":true,"description":"Use prompt optimizer"},
"first_frame_image":{"type":"string","title":"First Frame Image","format":"uri","description":"First frame image for video generation. The output video will have the same aspect ratio as this image."}
}}
```

---

## bytedance/seedance-1-pro-fast — INPUT:

```json
{ "type":"object","title":"Input","required":["prompt"],"properties":{
"fps":{"enum":[24],"type":"integer","title":"fps","description":"Frame rate (frames per second)","default":24,"x-order":5},
"seed":{"type":"integer","title":"Seed","nullable":true,"description":"Random seed. Set for reproducible generation"},
"image":{"type":"string","title":"Image","format":"uri","nullable":true,"description":"Input image for image-to-video generation"},
"prompt":{"type":"string","title":"Prompt","description":"Text prompt for video generation"},
"duration":{"type":"integer","title":"Duration","default":5,"maximum":12,"minimum":2,"description":"Video duration in seconds"},
"resolution":{"enum":["480p","720p","1080p"],"type":"string","title":"resolution","description":"Video resolution","default":"1080p","x-order":3},
"aspect_ratio":{"enum":["16:9","4:3","1:1","3:4","9:16","21:9","9:21"],"type":"string","title":"aspect_ratio","description":"Video aspect ratio. Ignored if an image is used.","default":"16:9","x-order":4},
"camera_fixed":{"type":"boolean","title":"Camera Fixed","default":false,"description":"Whether to fix camera position"}
}}
```

---

## kwaivgi/kling-v2.5-turbo-pro — INPUT:

```json
{ "type":"object","title":"Input","required":["prompt"],"properties":{
"image":{"type":"string","title":"Image","format":"uri","nullable":true,"deprecated":true,"description":"Deprecated: Use start_image instead."},
"prompt":{"type":"string","title":"Prompt","description":"Text prompt for video generation"},
"duration":{"enum":[5,10],"type":"integer","title":"duration","description":"Duration of the video in seconds","default":5,"x-order":4},
"start_image":{"type":"string","title":"Start Image","format":"uri","description":"First frame of the video"},
"aspect_ratio":{"enum":["16:9","9:16","1:1"],"type":"string","title":"aspect_ratio","description":"Aspect ratio of the video. Ignored if start_image is provided.","default":"16:9","x-order":3},
"negative_prompt":{"type":"string","title":"Negative Prompt","default":"","description":"Things you do not want to see in the video"}
}}
```

---

## Additional AI Model: Scene Regeneration

**Location:**
`app/api/regenerate-scene/route.ts:59-72`

**Model Used:**
Leonardo Phoenix 1.0 (same as Step 2B)

**Purpose:**
Allows users to regenerate individual storyboard images with different styles or prompts while maintaining scene consistency.

NEW FEATURE: Right now, we're ONLY using Leonardo Phoenix 1.0 (same as Step 2B). Now, make it so that whatever Image Generation (Text → Image) model we use for Step 2B, use the SAME model for the Scene Regeneration. (We don't let the user change the model used for Scene Regeneration - the model was already previously chosen by the user!)