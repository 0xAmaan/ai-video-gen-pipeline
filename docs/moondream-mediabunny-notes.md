⏺ Based on the Moondream documentation, here are the main use cases for your video generation pipeline:

  🎯 Primary Use Cases for Video Pipeline

  1. Frame-by-Frame Content Analysis

  - Scene Understanding: Analyze each frame to understand what's happening in the video
  - Consistency Checking: Verify that generated video frames maintain coherent content across scenes
  - Quality Assessment: Detect artifacts, inconsistencies, or problematic frames in generated videos

  2. Automated Video Captioning & Metadata

  - Frame Descriptions: Generate natural language descriptions for key frames
  - Scene Summaries: Create detailed captions for different segments of the video
  - Variable Length Captions: Short (for thumbnails), normal (for previews), or long (detailed scene descriptions)

  3. Visual Question Answering on Video Content

  - Content Verification: Ask questions about what's in each frame ("Is the character facing left?", "What objects
   are visible?")
  - Continuity Checking: Validate that story elements remain consistent across frames
  - User Queries: Allow users to ask questions about their generated video content

  4. Object Detection & Tracking

  - Character Localization: Detect where characters/subjects are positioned in each frame (returns bounding boxes)
  - Point Tracking: Track specific points of interest across frames (face centers, object centers)
  - Multi-object Scenes: Handle up to 20 objects per frame with configurable limits

  5. Spatial Reference & Grounding

  - Region-Specific Analysis: Query specific regions of frames using bounding boxes
  - Composition Feedback: Check if elements are positioned correctly in the frame
  - Storyboard Validation: Verify that generated frames match storyboard specifications

  6. Gaze Direction & Attention

  - Character Focus: Detect where characters are looking in each frame
  - Emotional Analysis: Understand attention and engagement of subjects
  - High-Accuracy Mode: Use face bounding boxes for precise gaze tracking

  7. Batch Processing for Efficiency

  - Multi-Frame Analysis: Process multiple video frames simultaneously
  - Different Queries per Frame: Ask different questions about different frames in one batch
  - Pipeline Integration: Efficient processing of entire video sequences

  8. Interactive Preview & Editing

  - Real-time Q&A: Users can ask questions about generated frames during preview
  - Streaming Responses: Get instant feedback while processing frames
  - Multi-turn Conversations: Ask follow-up questions about the same frame efficiently (KV-cache)

  ---
  💡 Specific Integration Opportunities

  For Your Storyboard → Video Flow:

  1. Storyboard Validation: Analyze storyboard images to extract detailed scene descriptions
  2. Frame Generation QA: After generating video frames, verify they match the storyboard intent
  3. Consistency Scoring: Compare adjacent frames to ensure smooth transitions and consistent styling
  4. User Refinement: Let users query specific frames ("Why does this character look different here?")

  Technical Advantages:

  - Small Model: 2B params (or 0.5B for edge) - can run locally/quickly
  - Efficient Caching: Encode each frame once, ask multiple questions
  - Streaming Support: Real-time feedback during video generation
  - LoRA Variants: Fine-tune for specific video styles or domains
    
    
    
    
    
    
Ah, now we're talking! You want to use Moondream's analysis to intelligently drive regeneration. Here's how to
  make it useful for content modification:

  🔄 The Feedback Loop Architecture

  Core Idea: Analysis → Prompt Refinement → Regeneration

  User: "Change the banana to an apple"
                  ↓
  1. Moondream analyzes current frame
     → "Gorilla holding yellow banana at position (0.45, 0.35)"
                  ↓
  2. Your system builds SMART regeneration prompt
     → Original: "Gorilla eating banana in rainforest"
     → Enhanced: "Gorilla eating RED APPLE in rainforest, apple at center of frame"
                  ↓
  3. Send to Replicate/Veo3 for regeneration
                  ↓
  4. Moondream validates new frame
     → "Is there an apple?" → "Yes, gorilla is holding a red apple"

  ---
  🎯 Practical Use Cases

  1. Intelligent Prompt Augmentation

  // User wants to change something
  const userEdit = "Make the gorilla look angrier"

  // Step 1: Analyze current frame with Moondream
  const analysis = await moondream.query(currentFrame,
    "Describe the gorilla's facial expression and body language in detail"
  )
  // → "The gorilla has a calm, neutral expression while eating"

  // Step 2: Detect gorilla position for consistency
  const position = await moondream.detect(currentFrame, "gorilla")
  // → {x_min: 0.2, y_min: 0.1, x_max: 0.8, y_max: 0.9}

  // Step 3: Build enhanced prompt
  const enhancedPrompt = `
    ${originalPrompt}
    The gorilla should have an angry, aggressive expression with bared teeth.
    Maintain gorilla position: centered in frame, occupying 60% of frame height.
    Keep: rainforest background, banana in hand
    Change: facial expression from calm to angry
  `

  // Step 4: Regenerate with Veo3
  const newVideo = await replicate.run("veo3", { prompt: enhancedPrompt })

  // Step 5: Validate
  const validation = await moondream.query(newFrame,
    "Does the gorilla look angry?"
  )
  // → "Yes, the gorilla has an aggressive expression with visible teeth"

  2. Consistency Preservation During Edits

  // User: "Change background to a city"

  // Extract what to KEEP
  const keepElements = await moondream.query(currentFrame,
    "List all objects and their positions, excluding the background"
  )
  // → "Gorilla (center, 60% frame), banana (right hand), green foliage (foreground)"

  const gorillaBox = await moondream.detect(currentFrame, "gorilla")
  const bananaPoint = await moondream.point(currentFrame, "banana")

  // Build prompt that preserves subject
  const prompt = `
    Gorilla eating banana in URBAN CITY setting with skyscrapers.
    Gorilla: same size and position (centered, occupying 60% of vertical frame)
    Banana: in gorilla's right hand at same position
    Background: modern city skyline instead of rainforest
  `

  3. Automatic Retry with Validation

  async function generateWithValidation(
    prompt: string,
    validationCriteria: string[],
    maxRetries: number = 3
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Generate
      const video = await replicate.run("veo3", { prompt })

      // Extract frame for validation
      const frame = await extractFrame(video, frameNumber)

      // Validate with Moondream
      const checks = await Promise.all(
        validationCriteria.map(criteria =>
          moondream.query(frame, criteria)
        )
      )

      // Check if all criteria passed
      const allPassed = checks.every(check =>
        check.answer.toLowerCase().includes("yes")
      )

      if (allPassed) {
        return video // Success!
      }

      // Failed - analyze what's wrong
      const issue = await moondream.query(frame,
        "What's different from: " + prompt
      )

      // Refine prompt based on issue
      prompt = refinePrompt(prompt, issue.answer)
    }

    throw new Error("Could not generate valid video after retries")
  }

  // Usage
  const video = await generateWithValidation(
    "Gorilla eating banana in rainforest",
    [
      "Is there a gorilla in the image?",
      "Is the gorilla holding a banana?",
      "Is there a rainforest background?"
    ]
  )

  4. Semantic Change Detection

  // User makes vague edit: "Make it more dramatic"

  // Analyze before
  const before = await moondream.caption(originalFrame, { length: "long" })

  // Generate with "dramatic" modifier
  const dramaticPrompt = `${originalPrompt}, dramatic lighting, intense atmosphere`
  const newVideo = await replicate.run("veo3", { prompt: dramaticPrompt })

  // Analyze after
  const after = await moondream.caption(newFrame, { length: "long" })

  // Show user what changed
  const changes = await moondream.query(null, // text-only mode
    `Compare these descriptions and list what changed:
    Before: ${before.caption}
    After: ${after.caption}`
  )

  // User can approve/reject based on actual changes

  5. Region-Specific Edits

  // User clicks on banana area: "Change this to an apple"

  // Get precise region info
  const clickRegion = { x: 0.65, y: 0.4 } // where user clicked

  const objectAtClick = await moondream.query(originalFrame,
    "What object is at this location?",
    { spatial_refs: [clickRegion] }
  )
  // → "A yellow banana"

  // Build targeted prompt
  const prompt = `
    ${originalPrompt.replace("banana", "red apple")}
    Important: The apple should be in the same position as the previous banana,
    held in the gorilla's right hand at approximately 65% from left, 40% from top.
  `

  ---
  🏗️ Suggested Endpoint Architecture

  // POST /api/video/regenerate
  {
    projectId: string
    frameNumber: number
    editType: "object-swap" | "style-change" | "background-change" | "refinement"
    editRequest: string  // "Change banana to apple"

    // Optional: let Moondream guide the edit
    useIntelligentRetry: boolean
  }

  async function handleRegenerate(req) {
    // 1. Get current frame
    const currentFrame = await getFrame(req.projectId, req.frameNumber)

    // 2. Analyze current state
    const currentState = await moondream.caption(currentFrame, { length: "long" })
    const objects = await moondream.query(currentFrame,
      "List all objects and their positions"
    )

    // 3. Build new prompt incorporating analysis
    const newPrompt = buildSmartPrompt({
      originalPrompt: getOriginalPrompt(req.projectId),
      currentState: currentState.caption,
      editRequest: req.editRequest,
      preserveElements: objects.answer
    })

    // 4. Generate with validation loop
    if (req.useIntelligentRetry) {
      return await generateWithValidation(
        newPrompt,
        buildValidationCriteria(req.editRequest)
      )
    }

    // 5. Simple regeneration
    return await replicate.run("veo3", { prompt: newPrompt })
  }

  ---
  💡 Key Insight

  Moondream's value is being the "eyes" of your pipeline:
  - Before generation: Analyze storyboards to extract detailed scene requirements
  - During generation: Validate frames meet criteria, trigger retries if needed
  - After generation: Help users understand what they got vs what they wanted
  - For edits: Extract context to build smarter regeneration prompts

  Would you like me to mock up a specific endpoint that shows this in action? Or explore how to integrate this 
  into your existing video pipeline architecture?
  
  
  
  
  
  
  
  
  
    📦 Mediabunny Overview

  Mediabunny is a complete browser-based media toolkit for reading, writing, and converting video/audio files.
  Think of it as FFmpeg for the web - pure TypeScript, zero dependencies, runs directly in the browser.

  ---
  🎯 Core Capabilities

  1. Reading Media Files

  - Extract metadata (duration, dimensions, frame rate, codec info)
  - Read video frames at specific timestamps
  - Extract audio chunks
  - Decode and process media data
  - Support for MP4, WebM, and other formats

  2. Writing Media Files

  - Create videos from scratch in the browser
  - Mux video and audio tracks
  - Support for multiple output formats (MP4, WebM, MP3)
  - Real-time encoding using WebCodecs API

  3. Converting Media Files

  - Transmuxing: Change container format (MP4 → WebM)
  - Transcoding: Change codecs
  - Video operations: Resize, rotate, crop, adjust frame rate
  - Audio operations: Resample, change channels (mono/stereo)
  - Compression: Control bitrate and quality
  - Custom processing: Apply overlays, filters, transformations

  ---
  💡 Main Use Cases

  Listed in Their Docs:

  1. File conversion & compression
  2. Displaying file metadata (duration, dimensions)
  3. Extracting thumbnails
  4. Creating videos in the browser
  5. Building a video editor
  6. Live recording & streaming
  7. Sample-accurate playback via Web Audio API

  ---
  🔥 Key Features for Your Video Pipeline

  8. Thumbnail/Frame Extraction

  // Extract thumbnail at 10s mark
  const sink = new CanvasSink(videoTrack, { width: 320 });
  const result = await sink.getCanvas(10);
  result.canvas; // HTMLCanvasElement you can use

  // Generate 5 evenly-spaced thumbnails
  for await (const result of sink.canvasesAtTimestamps(timestamps)) {
    // Each result has .canvas, .timestamp, .duration
  }

  9. Video Metadata Extraction

  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS
  });

  const duration = await input.computeDuration();
  const videoTrack = await input.getPrimaryVideoTrack();

  videoTrack.displayWidth;
  videoTrack.displayHeight;
  videoTrack.rotation;
  // ... and more

  10. Frame-by-Frame Access

  const sink = new VideoSampleSink(videoTrack);

  // Get specific frame at 5s
  const frame = await sink.getSample(5);
  frame.draw(ctx, 0, 0); // Draw to canvas

  // Loop through all frames
  for await (const sample of sink.samples(0, 30)) {
    // Process each frame
  }

  11. Video Processing & Conversion

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      width: 1280,
      height: 720,
      fit: 'contain',
      codec: 'avc',
      bitrate: 5_000_000,
      process: async (sample) => {
        // Custom frame processing!
        // Apply overlays, filters, etc.
        return processedFrame;
      }
    }
  });

  await conversion.execute();

  12. Progress Monitoring

  conversion.onProgress = (progress) => {
    console.log(`${(progress * 100).toFixed(1)}%`);
  };

  ---
  🎬 How Mediabunny Fits YOUR Video Pipeline

  Use Case 1: Storyboard Frame Extraction

  // User uploads storyboard images/video
  const input = new Input({ source: new BlobSource(storyboardFile) });
  const videoTrack = await input.getPrimaryVideoTrack();
  const sink = new CanvasSink(videoTrack);

  // Extract frames for AI analysis with Moondream
  for await (const result of sink.canvases()) {
    const frameBlob = await canvasToBlob(result.canvas);
    const analysis = await moondream.caption(frameBlob);
    // Use analysis to enhance prompts for video generation
  }

  Use Case 2: Generated Video QA & Validation

  // After Replicate generates video
  const generatedVideo = await fetch(replicateVideoUrl).then(r => r.blob());
  const input = new Input({ source: new BlobSource(generatedVideo) });

  // Extract frames for Moondream validation
  const videoTrack = await input.getPrimaryVideoTrack();
  const sink = new CanvasSink(videoTrack);

  // Validate frame 47
  const frame47 = await sink.getCanvas(frameNumberToTimestamp(47));
  const validation = await moondream.query(frame47.canvas,
    "Does this match the description: gorilla eating banana?"
  );

  Use Case 3: Thumbnail Generation for UI

  // Generate preview thumbnails for timeline
  const thumbnails = [];
  const timestamps = generateEvenTimestamps(videoDuration, 10);

  for await (const result of sink.canvasesAtTimestamps(timestamps)) {
    const thumbnailUrl = result.canvas.toDataURL();
    thumbnails.push({ timestamp: result.timestamp, url: thumbnailUrl });
  }

  // Display in your video editor timeline

  Use Case 4: Video Editing & Re-encoding

  // User wants to trim/crop/resize generated video
  const conversion = await Conversion.init({
    input: new Input({ source: new BlobSource(originalVideo) }),
    output: new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget()
    }),
    video: {
      crop: { left: 100, top: 50, width: 1920, height: 1080 },
      width: 1280,
      height: 720,
      // Trim by processing only certain timestamps
    }
  });

  await conversion.execute();
  const editedVideo = output.target.buffer;

  Use Case 5: Frame-by-Frame Moondream Analysis

  // Analyze every Nth frame for consistency
  const videoTrack = await input.getPrimaryVideoTrack();
  const sink = new VideoSampleSink(videoTrack);

  for await (const sample of sink.samples()) {
    if (sample.timestamp % 1 === 0) { // Every 1 second
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      sample.draw(ctx, 0, 0);

      // Moondream analysis
      const objects = await moondream.detect(canvas, "person");
      // Check consistency, track objects across frames
    }
  }

  ---
  🔗 Combined Power: Mediabunny + Moondream

  | Mediabunny            | +   | Moondream          | =   | Your Pipeline              |
  |-----------------------|-----|--------------------|-----|----------------------------|
  | Extracts frames       |     | Analyzes content   |     | Validates generated videos |
  | Reads metadata        |     | Understands scenes |     | Builds smart prompts       |
  | Generates thumbnails  |     | Detects objects    |     | Creates timeline preview   |
  | Converts/processes    |     | Validates quality  |     | Auto-retry bad frames      |
  | Provides frame access |     | Tracks consistency |     | Ensure coherent output     |

  ---
  💭 Bottom Line

  Mediabunny handles all the video file operations (reading, writing, converting, extracting frames), while
  Moondream provides the "intelligence" to understand what's in those frames.

  Together, they let you:
  13. Extract frames from generated videos
  14. Analyze them with Moondream for content validation
  15. Re-generate problematic frames with enhanced prompts
  16. Process and edit videos directly in the browser
  17. Create thumbnails for UI/UX
  18. Monitor quality throughout the pipeline
  
  
  
  
  
  
  
    ---
  📥 Loading Videos from Replicate URLs

  First, you need to fetch the remote video and convert it to a format Mediabunny can work with:

  // Get video from Replicate URL
  const replicateVideoUrl = "https://replicate.delivery/pbxt/abc123.mp4";

  // Fetch as Blob
  const videoBlob = await fetch(replicateVideoUrl).then(r => r.blob());

  // Create Mediabunny Input
  const input = new Input({
    source: new BlobSource(videoBlob),
    formats: ALL_FORMATS
  });

  ---
  📤 Exporting Options with Mediabunny

  Mediabunny provides Targets that determine where the output goes. Here are your options:

  19. BufferTarget (In-Memory)

  Best for: Immediate download, uploading to server, or further processing

  import { Output, Mp4OutputFormat, BufferTarget } from 'mediabunny';

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget() // Stores result in memory
  });

  // ... do conversion ...
  await conversion.execute();

  // Get the final video as ArrayBuffer
  const videoArrayBuffer = output.target.buffer;

  // Convert to Blob for download
  const videoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });

  // Option A: Trigger browser download
  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'edited-video.mp4';
  a.click();
  URL.revokeObjectURL(url);

  // Option B: Upload to your server/storage
  const formData = new FormData();
  formData.append('video', videoBlob, 'edited-video.mp4');
  await fetch('/api/upload', { method: 'POST', body: formData });

  20. StreamTarget (Streaming to Server)

  Best for: Large videos, streaming to cloud storage during generation

  import { StreamTarget } from 'mediabunny';

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new StreamTarget({
      onData: async (data, position) => {
        // Stream chunks to server as they're generated
        await fetch('/api/upload-chunk', {
          method: 'POST',
          body: JSON.stringify({
            chunk: Array.from(new Uint8Array(data)),
            position
          })
        });
      },
      onDone: async () => {
        // Finalize upload
        await fetch('/api/finalize-upload', { method: 'POST' });
      }
    })
  });

  21. FileSystemTarget (Save to Local File System)

  Best for: Desktop apps or when user has granted file system access

  import { FileSystemTarget } from 'mediabunny';

  // Using File System Access API (Chrome/Edge)
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: 'edited-video.mp4',
    types: [{
      description: 'Video Files',
      accept: { 'video/mp4': ['.mp4'] }
    }]
  });

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new FileSystemTarget(fileHandle)
  });

  // ... conversion runs ...
  // File is automatically written to disk

  ---
  🎬 Complete Example: Edit & Export Video

  Here's a full workflow for your use case:

  // POST /api/video/export
  async function exportEditedVideo(projectId: string) {
    // 1. Get all video segments from Replicate
    const project = await getProject(projectId);
    const videoUrls = project.generatedVideoUrls; // Array of Replicate URLs

    // 2. Fetch all videos as Blobs
    const videoBlobs = await Promise.all(
      videoUrls.map(url => fetch(url).then(r => r.blob()))
    );

    // 3. Create inputs for each segment
    const inputs = videoBlobs.map(blob => new Input({
      source: new BlobSource(blob),
      formats: ALL_FORMATS
    }));

    // 4. Set up output with BufferTarget
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget()
    });

    // 5. If just one video - convert/edit it
    if (inputs.length === 1) {
      const conversion = await Conversion.init({
        input: inputs[0],
        output,
        video: {
          // Apply edits here
          width: 1920,
          height: 1080,
          codec: 'avc',
          bitrate: 8_000_000
        }
      });

      await conversion.execute();
    }
    // 6. If multiple videos - stitch them together
    else {
      await stitchVideos(inputs, output);
    }

    // 7. Get the final video
    const finalVideoBuffer = output.target.buffer;
    const finalVideoBlob = new Blob([finalVideoBuffer], { type: 'video/mp4' });

    // 8. Upload to permanent storage (S3, Cloudflare R2, etc.)
    const uploadUrl = await uploadToStorage(finalVideoBlob, projectId);

    // 9. Save to database
    await db.projects.update(projectId, {
      finalVideoUrl: uploadUrl,
      exportedAt: new Date()
    });

    return { videoUrl: uploadUrl };
  }

  ---
  🔗 Stitching Multiple Videos Together

  Mediabunny doesn't have a built-in "concat" API, but you can stitch videos by processing frames sequentially:

  async function stitchVideos(inputs: Input[], output: Output) {
    // Start the output
    const videoTrack1 = await inputs[0].getPrimaryVideoTrack();
    const audioTrack1 = await inputs[0].getPrimaryAudioTrack();

    // Add tracks to output
    const outVideoTrack = await output.addVideoTrack({
      codec: 'avc',
      width: videoTrack1.displayWidth,
      height: videoTrack1.displayHeight
    });

    const outAudioTrack = await output.addAudioTrack({
      codec: 'aac',
      sampleRate: audioTrack1.sampleRate,
      numberOfChannels: audioTrack1.numberOfChannels
    });

    output.start();

    let currentTimestamp = 0;

    // Process each input video sequentially
    for (const input of inputs) {
      const videoTrack = await input.getPrimaryVideoTrack();
      const audioTrack = await input.getPrimaryAudioTrack();

      const videoSink = new VideoSampleSink(videoTrack);
      const audioSink = new AudioSampleSink(audioTrack);

      // Copy all video frames
      for await (const sample of videoSink.samples()) {
        await outVideoTrack.addSample({
          ...sample,
          timestamp: currentTimestamp + sample.timestamp
        });
      }

      // Copy all audio samples
      for await (const sample of audioSink.samples()) {
        await outAudioTrack.addSample({
          ...sample,
          timestamp: currentTimestamp + sample.timestamp
        });
      }

      // Update timestamp offset for next video
      currentTimestamp += await videoTrack.computeDuration();
    }

    await output.finalize();
  }

  ---
  🚀 Practical API Endpoint Structure

  // app/api/video/export/route.ts
  export async function POST(req: Request) {
    const { projectId } = await req.json();

    // Get project with video URLs
    const project = await db.projects.get(projectId);

    // Fetch videos from Replicate
    const videoBlobs = await Promise.all(
      project.videoUrls.map(url =>
        fetch(url).then(r => r.blob())
      )
    );

    // Process with Mediabunny
    const input = new Input({
      source: new BlobSource(videoBlobs[0]), // Or stitch multiple
      formats: ALL_FORMATS
    });

    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget()
    });

    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: 'avc',
        bitrate: 8_000_000
      }
    });

    // Track progress
    conversion.onProgress = (progress) => {
      // Send to client via SSE or WebSocket
      console.log(`Export progress: ${(progress * 100).toFixed(1)}%`);
    };

    await conversion.execute();

    // Get final video
    const videoBuffer = output.target.buffer;
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });

    // Upload to Cloudflare R2 / S3
    const finalUrl = await uploadToR2(videoBlob, `${projectId}/final.mp4`);

    // Update database
    await db.projects.update(projectId, {
      finalVideoUrl: finalUrl,
      status: 'completed'
    });

    return Response.json({
      success: true,
      videoUrl: finalUrl
    });
  }

  ---
  💾 Where to Store the Final Video?

  Option 1: Cloudflare R2 (Recommended)

  import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

  const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
    }
  });

  async function uploadToR2(blob: Blob, key: string) {
    const buffer = await blob.arrayBuffer();

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: 'video/mp4'
    }));

    return `https://your-r2-domain.com/${key}`;
  }

  Option 2: Direct Download (Browser)

  // Client-side export
  const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectTitle}-final.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  Option 3: Vercel Blob

  import { put } from '@vercel/blob';

  const blob = await put(
    `videos/${projectId}/final.mp4`,
    videoBlob,
    { access: 'public' }
  );

  return blob.url;

  ---
  🎯 Summary

  To export a video with Mediabunny:

  22. Fetch from Replicate URL → Blob
  23. Create Input → new Input({ source: new BlobSource(blob) })
  24. Create Output → new Output({ target: new BufferTarget() })
  25. Process/Convert → Conversion.init() + conversion.execute()
  26. Get Result → output.target.buffer (ArrayBuffer)
  27. Export → Download, upload to R2/S3, or save locally

  The key insight: Mediabunny doesn't "export" to disk automatically - it gives you an ArrayBuffer that YOU decide
   what to do with (download, upload, store, etc.).

  Does this answer your question about exporting?