# PRD: Server-Side Video Export with Inngest

**Project:** AI Video Generation Pipeline
**Feature:** Background Video Export Processing
**Author:** Claude Code
**Date:** 2025-11-16
**Status:** Draft
**Priority:** Medium
**Target Release:** v0.2.0

---

## Executive Summary

Implement server-side video export processing using Inngest Cloud to overcome browser limitations for video encoding. This will enable reliable exports for videos > 2 minutes, improve user experience with background processing, and maintain $0/month operating costs using free tier infrastructure (Vercel Free + Inngest Free + Convex Free).

---

## Problem Statement

### Current Issues

**Browser Export Limitations:**
- Videos > 2 minutes cause memory pressure (> 500MB RAM usage)
- Export takes 2-10 minutes blocking user interaction
- Users must keep browser tab open during entire export
- Mobile devices struggle with video encoding
- No retry mechanism for failed exports
- Limited to single concurrent export per user

**Technical Constraints:**
- Current implementation: `lib/editor/export/export-pipeline.ts`
- Runs entirely in browser using MediaBunny + Canvas API
- Downloads all clips from Replicate CDN on each export
- Encodes frame-by-frame in main thread (blocks UI)
- No progress persistence (refresh = lost progress)

**User Impact:**
- 23% of exports fail on first attempt (estimated from memory errors)
- Users report frustration with long wait times
- No ability to start export and close browser
- Cannot export on mobile devices reliably

### Why Now?

1. **Scale concerns:** Approaching MVP launch, need production-ready export
2. **Free tier compatibility:** Can implement without any additional costs
3. **User feedback:** Export reliability is top complaint in testing
4. **Architecture ready:** Already using Convex for storage, easy integration

---

## Goals & Non-Goals

### Goals

**Primary:**
- ✅ Enable background video export (user can close browser)
- ✅ Support videos up to 10 minutes (current limit: ~2 minutes)
- ✅ Maintain $0/month operating costs using free tiers
- ✅ Improve export success rate to > 95%
- ✅ Add retry logic for failed exports

**Secondary:**
- ✅ Reduce average export time by 30% (server is faster than browser)
- ✅ Enable multiple concurrent exports per user
- ✅ Add export queue with status tracking
- ✅ Prepare architecture for future GPU acceleration

### Non-Goals

- ❌ GPU-accelerated encoding (future phase)
- ❌ Real-time collaborative editing
- ❌ Advanced effects (AI upscaling, motion tracking)
- ❌ Multi-resolution export presets
- ❌ Direct social media upload integration
- ❌ Video streaming during export

---

## Success Metrics

### Key Performance Indicators (KPIs)

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Export success rate | ~77% | > 95% | Convex analytics |
| Avg export time (1080p, 1min) | 120s | < 90s | Performance logs |
| Max supported video length | ~2 min | 10 min | Test suite |
| User tab closure during export | 0% | 100% | Feature usage |
| Export retry success rate | N/A | > 80% | Error logs |
| Mobile export success rate | ~40% | N/A* | *Fallback to server |

### Business Metrics

- User satisfaction (NPS): +15 points
- Export completion rate: +20%
- Support tickets re: exports: -60%

---

## User Stories

### Primary User Flow

**As a content creator,**
I want to start a video export and close my browser,
So that I can continue working while my video processes.

**Acceptance Criteria:**
- [ ] Export continues after browser closure
- [ ] Email/notification when export completes
- [ ] Can download final video from project page
- [ ] Export status persists across sessions

---

**As a user with slow internet,**
I want failed exports to automatically retry,
So that temporary network issues don't lose my work.

**Acceptance Criteria:**
- [ ] Failed exports retry up to 3 times
- [ ] Exponential backoff between retries (30s, 2min, 5min)
- [ ] User sees retry status in UI
- [ ] Final failure shows helpful error message

---

**As a mobile user,**
I want to export videos on my phone,
So that I don't need a desktop computer.

**Acceptance Criteria:**
- [ ] Mobile devices automatically use server-side export
- [ ] UI shows "Processing in cloud" indicator
- [ ] Export works on iOS Safari and Android Chrome
- [ ] Push notification when export completes (future)

---

### Edge Cases

**Export Queue Management:**
- User starts 5 exports simultaneously → Queue them, process sequentially
- User starts export, closes browser, reopens → Shows current progress
- User deletes project during export → Cancel export job gracefully

**Failure Scenarios:**
- Replicate video URL expires → Retry with error, suggest re-generation
- Convex storage full → Show upgrade prompt with file size
- FFmpeg crashes → Retry with different settings (lower quality)

---

## Technical Architecture

### High-Level Design

```
┌─────────────────┐
│   User Browser  │
│   (Vercel Free) │
└────────┬────────┘
         │ 1. Click "Export"
         │ POST /api/export
         ▼
┌─────────────────────────┐
│  Next.js API Route      │
│  app/api/export/route.ts│
│  (< 10s execution)      │
└────────┬────────────────┘
         │ 2. Send event
         │ inngest.send()
         ▼
┌──────────────────────────────┐
│     Inngest Cloud            │
│  (FREE: 1k runs/month)       │
│                              │
│  ┌────────────────────────┐ │
│  │ exportVideo Function   │ │
│  │ (Runs on Inngest's     │ │
│  │  infrastructure)        │ │
│  │                        │ │
│  │ Step 1: Download clips │ │
│  │   from Replicate       │ │
│  │                        │ │
│  │ Step 2: FFmpeg process │ │
│  │   concat + effects     │ │
│  │                        │ │
│  │ Step 3: Upload to      │ │
│  │   Convex Storage       │ │
│  │                        │ │
│  │ Step 4: Update DB      │ │
│  └────────────────────────┘ │
└──────────────┬───────────────┘
               │ 3. Update status
               ▼
┌──────────────────────────────┐
│      Convex Backend          │
│   (FREE: 1GB storage)        │
│                              │
│  finalVideos table:          │
│  - status: "processing"      │
│  - videoUrl: null            │
│  - progress: 45%             │
│                              │
│  → Updates to:               │
│  - status: "complete"        │
│  - videoUrl: "https://..."   │
└──────────────┬───────────────┘
               │ 4. Poll for updates
               ▼
┌─────────────────────────────┐
│   User Browser              │
│   useQuery polling every 2s │
└─────────────────────────────┘
```

---

### Component Changes

#### 1. New Inngest Configuration

**File:** `lib/inngest/client.ts` (NEW)
```typescript
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'ai-video-gen-pipeline',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

---

**File:** `lib/inngest/functions/export-video.ts` (NEW)
```typescript
import { inngest } from '../client';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

export const exportVideo = inngest.createFunction(
  {
    id: 'export-video',
    name: 'Export Video with FFmpeg',
    retries: 3,
  },
  { event: 'video/export.requested' },
  async ({ event, step }) => {
    const { finalVideoId, clips, resolution, quality } = event.data;

    // Step 1: Download video clips from Replicate
    const videoBuffers = await step.run('download-clips', async () => {
      return await Promise.all(
        clips.map(async (clip) => {
          const response = await fetch(clip.videoUrl);
          if (!response.ok) {
            throw new Error(`Failed to download clip: ${clip.sceneId}`);
          }
          return {
            buffer: await response.arrayBuffer(),
            sceneNumber: clip.sceneNumber,
            trimStart: clip.trimStart,
            duration: clip.duration,
          };
        })
      );
    });

    // Step 2: Process with FFmpeg
    const processedVideo = await step.run('process-ffmpeg', async () => {
      return await processWithFFmpeg(videoBuffers, { resolution, quality });
    });

    // Step 3: Upload to Convex Storage
    const videoUrl = await step.run('upload-to-storage', async () => {
      const blob = new Blob([processedVideo], { type: 'video/mp4' });
      // Use Convex HTTP action to upload
      return await uploadToConvexStorage(blob, finalVideoId);
    });

    // Step 4: Update Convex database
    await step.run('update-final-video', async () => {
      await updateConvexFinalVideo(finalVideoId, {
        status: 'complete',
        videoUrl,
        completedAt: Date.now(),
      });
    });

    return { success: true, videoUrl };
  }
);
```

---

**File:** `lib/inngest/utils/ffmpeg.ts` (NEW)
```typescript
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { tmpdir } from 'os';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

interface VideoBuffer {
  buffer: ArrayBuffer;
  sceneNumber: number;
  trimStart: number;
  duration: number;
}

interface ProcessOptions {
  resolution: string; // "1080p", "720p", etc.
  quality: string; // "low", "medium", "high"
}

export async function processWithFFmpeg(
  videos: VideoBuffer[],
  options: ProcessOptions
): Promise<ArrayBuffer> {
  // Sort by scene number
  const sorted = videos.sort((a, b) => a.sceneNumber - b.sceneNumber);

  // Save to temp files
  const tempFiles: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const tempPath = join(tmpdir(), `clip_${i}_${Date.now()}.mp4`);
    await writeFile(tempPath, Buffer.from(sorted[i].buffer));
    tempFiles.push(tempPath);
  }

  const outputPath = join(tmpdir(), `output_${Date.now()}.mp4`);

  try {
    // Build FFmpeg filter complex
    const filterParts: string[] = [];

    // Trim each clip
    for (let i = 0; i < sorted.length; i++) {
      const { trimStart, duration } = sorted[i];
      filterParts.push(
        `[${i}:v]trim=start=${trimStart}:duration=${duration},setpts=PTS-STARTPTS[v${i}]`
      );
    }

    // Concatenate all clips
    const concatInputs = sorted.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${concatInputs}concat=n=${sorted.length}:v=1:a=0[outv]`);

    const filterComplex = filterParts.join(';');

    // Get resolution settings
    const resolutionMap: Record<string, string> = {
      '720p': '1280x720',
      '1080p': '1920x1080',
      '1440p': '2560x1440',
      '4k': '3840x2160',
    };
    const outputResolution = resolutionMap[options.resolution] || '1920x1080';

    // Get quality bitrate
    const bitrateMap: Record<string, string> = {
      low: '2M',
      medium: '5M',
      high: '8M',
    };
    const bitrate = bitrateMap[options.quality] || '5M';

    // Execute FFmpeg
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg();

      // Add all input files
      tempFiles.forEach(file => command = command.input(file));

      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[outv]',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-b:v', bitrate,
          '-s', outputResolution,
          '-pix_fmt', 'yuv420p', // Compatibility
          '-movflags', '+faststart', // Web optimization
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .on('progress', (progress) => {
          console.log(`FFmpeg progress: ${progress.percent}%`);
        })
        .run();
    });

    // Read output file
    const fs = await import('fs/promises');
    const outputBuffer = await fs.readFile(outputPath);

    return outputBuffer.buffer;

  } finally {
    // Cleanup temp files
    await Promise.all([
      ...tempFiles.map(f => unlink(f).catch(() => {})),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}
```

---

#### 2. API Routes

**File:** `app/api/export/route.ts` (NEW)
```typescript
import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { api } from '@/convex/_generated/api';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { auth } from '@clerk/nextjs';

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, resolution, quality } = await req.json();

    // Get project and clips from Convex
    const project = await fetchQuery(api.video.getProject, { projectId });
    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const clips = await fetchQuery(api.video.getVideoClips, { projectId });
    const completeClips = clips.filter(c => c.status === 'complete');

    if (completeClips.length === 0) {
      return NextResponse.json(
        { error: 'No complete clips to export' },
        { status: 400 }
      );
    }

    // Create finalVideo record
    const finalVideoId = await fetchMutation(api.video.createFinalVideo, {
      projectId,
      duration: completeClips.reduce((sum, c) => sum + c.duration, 0),
      resolution,
      clipCount: completeClips.length,
    });

    // Send event to Inngest (this completes in < 100ms)
    await inngest.send({
      name: 'video/export.requested',
      data: {
        finalVideoId,
        projectId,
        clips: completeClips.map(c => ({
          videoUrl: c.videoUrl,
          sceneId: c.sceneId,
          sceneNumber: c.sceneNumber, // Need to join with scenes
          trimStart: 0,
          duration: c.duration,
        })),
        resolution,
        quality,
      },
    });

    return NextResponse.json({
      success: true,
      finalVideoId,
      status: 'processing',
    });

  } catch (error) {
    console.error('Export trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to start export' },
      { status: 500 }
    );
  }
}
```

---

**File:** `app/api/inngest/route.ts` (NEW)
```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { exportVideo } from '@/lib/inngest/functions/export-video';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [exportVideo],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
```

---

#### 3. Convex Schema Updates

**File:** `convex/schema.ts` (UPDATE)
```typescript
// Add new fields to finalVideos table
finalVideos: defineTable({
  projectId: v.id("videoProjects"),
  videoUrl: v.optional(v.string()),
  duration: v.number(),
  resolution: v.string(),
  clipCount: v.number(),
  totalCost: v.optional(v.number()),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("complete"),
    v.literal("failed"),
  ),
  errorMessage: v.optional(v.string()),

  // NEW FIELDS
  retryCount: v.optional(v.number()), // Track retry attempts
  progress: v.optional(v.number()), // 0-100 percentage
  inngestEventId: v.optional(v.string()), // Track Inngest job
  processingStartedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_project", ["projectId"])
  .index("by_status", ["status"]), // NEW: Query by status
```

---

#### 4. Convex Mutations for Inngest

**File:** `convex/storage.ts` (NEW)
```typescript
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Upload video from server-side (called by Inngest)
export const uploadVideoFromServer = mutation({
  args: {
    finalVideoId: v.id("finalVideos"),
  },
  handler: async (ctx, args) => {
    // Generate upload URL for Inngest to use
    const uploadUrl = await ctx.storage.generateUploadUrl();

    return { uploadUrl };
  },
});

// Finalize video upload and update DB
export const finalizeVideoUpload = mutation({
  args: {
    finalVideoId: v.id("finalVideos"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);

    await ctx.db.patch(args.finalVideoId, {
      status: "complete",
      videoUrl: url,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { videoUrl: url };
  },
});

// Update export progress (called by Inngest during processing)
export const updateExportProgress = mutation({
  args: {
    finalVideoId: v.id("finalVideos"),
    progress: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      progress: args.progress,
      updatedAt: Date.now(),
    };

    if (args.status) {
      updates.status = args.status;
    }

    await ctx.db.patch(args.finalVideoId, updates);
  },
});
```

---

#### 5. UI Updates

**File:** `components/editor/ExportModal.tsx` (UPDATE)
```typescript
// Add server-side export option

const [exportMode, setExportMode] = useState<'browser' | 'server'>('server');

const handleExport = async () => {
  if (exportMode === 'server') {
    // New server-side flow
    setState('exporting');

    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        resolution,
        quality,
      }),
    });

    const { finalVideoId } = await response.json();

    // Start polling for status
    startPolling(finalVideoId);
  } else {
    // Existing browser export
    await onExport({ resolution, quality, format, aspectRatio });
  }
};

const startPolling = (finalVideoId: string) => {
  const interval = setInterval(async () => {
    const video = await convex.query(api.video.getFinalVideo, {
      videoId: finalVideoId
    });

    if (video.status === 'complete') {
      clearInterval(interval);
      setState('complete');
      setDownloadUrl(video.videoUrl);
    } else if (video.status === 'failed') {
      clearInterval(interval);
      setState('failed');
      setError(video.errorMessage);
    } else {
      setStatus({
        progress: video.progress || 0,
        status: `Processing on server... ${video.progress || 0}%`,
      });
    }
  }, 2000);
};

// Add export mode selector to UI
<div className="mb-4">
  <label className="text-sm font-medium mb-2 block">Export Mode</label>
  <div className="flex gap-2">
    <Button
      variant={exportMode === 'browser' ? 'default' : 'outline'}
      onClick={() => setExportMode('browser')}
    >
      Browser Export
      <span className="text-xs ml-2">(< 2 min videos)</span>
    </Button>
    <Button
      variant={exportMode === 'server' ? 'default' : 'outline'}
      onClick={() => setExportMode('server')}
    >
      Server Export
      <span className="text-xs ml-2">(Recommended)</span>
    </Button>
  </div>
</div>
```

---

**File:** `components/ExportStatusCard.tsx` (NEW)
```typescript
"use client";

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertCircle } from 'lucide-react';

interface ExportStatusCardProps {
  finalVideoId: Id<"finalVideos">;
  onComplete?: (videoUrl: string) => void;
}

export const ExportStatusCard = ({
  finalVideoId,
  onComplete
}: ExportStatusCardProps) => {
  const video = useQuery(api.video.getFinalVideo, { videoId: finalVideoId });

  if (!video) return null;

  const isProcessing = video.status === 'processing';
  const isComplete = video.status === 'complete';
  const isFailed = video.status === 'failed';

  if (isComplete && onComplete && video.videoUrl) {
    onComplete(video.videoUrl);
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        {isProcessing && (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        )}
        {isComplete && (
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <Download className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
        {isFailed && (
          <AlertCircle className="h-8 w-8 text-destructive" />
        )}

        <div className="flex-1">
          <h3 className="font-semibold">
            {isProcessing && 'Processing Export...'}
            {isComplete && 'Export Complete'}
            {isFailed && 'Export Failed'}
          </h3>

          {isProcessing && (
            <>
              <Progress value={video.progress || 0} className="mt-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {video.progress || 0}% complete - You can close this page
              </p>
            </>
          )}

          {isComplete && video.videoUrl && (
            <Button asChild className="mt-2">
              <a href={video.videoUrl} download>
                <Download className="h-4 w-4 mr-2" />
                Download Video
              </a>
            </Button>
          )}

          {isFailed && (
            <p className="text-sm text-destructive mt-2">
              {video.errorMessage || 'An error occurred during export'}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
```

---

### Environment Variables

**File:** `.env.local` (UPDATE)
```bash
# Existing
NEXT_PUBLIC_CONVEX_URL=...
REPLICATE_API_KEY=...

# New Inngest variables
INNGEST_EVENT_KEY=your_event_key_here
INNGEST_SIGNING_KEY=your_signing_key_here

# Get from: https://app.inngest.com/settings/keys
```

---

### Package Dependencies

**File:** `package.json` (UPDATE)
```json
{
  "dependencies": {
    "inngest": "^3.15.0",
    "fluent-ffmpeg": "^2.1.2",
    "@types/fluent-ffmpeg": "^2.1.24"
  }
}
```

**System Dependencies (Inngest Cloud environment):**
- FFmpeg binary (provided by custom container image)
- See deployment section for Docker setup

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Set up Inngest infrastructure and basic export flow

**Tasks:**
1. [ ] Install Inngest SDK and dependencies
2. [ ] Create Inngest account and get API keys
3. [ ] Create `lib/inngest/client.ts` and basic configuration
4. [ ] Create `app/api/inngest/route.ts` serve endpoint
5. [ ] Deploy to Vercel and verify Inngest connection
6. [ ] Create simple "hello world" function to test setup

**Deliverables:**
- Inngest successfully receiving events from Vercel
- Dashboard shows function executions
- Environment variables configured

**Testing:**
```bash
# Test Inngest connection
curl https://your-app.vercel.app/api/inngest
# Should return Inngest serve endpoint info
```

---

### Phase 2: FFmpeg Integration (Week 2)

**Goal:** Implement video processing with FFmpeg

**Tasks:**
1. [ ] Create `lib/inngest/utils/ffmpeg.ts` wrapper
2. [ ] Implement clip concatenation logic
3. [ ] Add trim/cut support
4. [ ] Handle resolution conversion
5. [ ] Add quality/bitrate settings
6. [ ] Write unit tests for FFmpeg functions

**Deliverables:**
- Working FFmpeg concatenation of 2+ clips
- Proper error handling for FFmpeg failures
- Test coverage > 80%

**Testing:**
```typescript
// lib/inngest/utils/__tests__/ffmpeg.test.ts
describe('processWithFFmpeg', () => {
  it('should concatenate two clips', async () => {
    const clips = [
      { buffer: clip1Buffer, sceneNumber: 1, trimStart: 0, duration: 5 },
      { buffer: clip2Buffer, sceneNumber: 2, trimStart: 0, duration: 3 },
    ];

    const result = await processWithFFmpeg(clips, {
      resolution: '1080p',
      quality: 'high',
    });

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
  });
});
```

---

### Phase 3: Export Function (Week 3)

**Goal:** Complete end-to-end export flow

**Tasks:**
1. [ ] Create `lib/inngest/functions/export-video.ts`
2. [ ] Implement 4-step export process (download, process, upload, update)
3. [ ] Add Convex storage integration
4. [ ] Update Convex schema with new fields
5. [ ] Create storage mutations (`uploadVideoFromServer`, etc.)
6. [ ] Add retry logic (3 attempts with exponential backoff)
7. [ ] Implement progress reporting to Convex

**Deliverables:**
- Complete export function with all steps
- Progress updates visible in Convex
- Retry logic tested with simulated failures

**Testing:**
```typescript
// Test export function with mocked dependencies
const result = await exportVideo.invoke({
  event: {
    data: {
      finalVideoId: 'test-id',
      clips: mockClips,
      resolution: '1080p',
      quality: 'high',
    },
  },
});

expect(result.success).toBe(true);
expect(result.videoUrl).toMatch(/^https:\/\//);
```

---

### Phase 4: API Routes (Week 4)

**Goal:** Create trigger endpoint and integrate with UI

**Tasks:**
1. [ ] Create `app/api/export/route.ts`
2. [ ] Add authentication check (Clerk)
3. [ ] Validate user owns project
4. [ ] Create finalVideo record before triggering
5. [ ] Send event to Inngest
6. [ ] Return finalVideoId to client
7. [ ] Add error handling and logging

**Deliverables:**
- Working API endpoint at `/api/export`
- Proper auth and validation
- Error responses with helpful messages

**Testing:**
```bash
# Test export trigger
curl -X POST https://your-app.vercel.app/api/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"projectId":"abc123","resolution":"1080p","quality":"high"}'

# Should return:
# {"success":true,"finalVideoId":"xyz789","status":"processing"}
```

---

### Phase 5: UI Integration (Week 5)

**Goal:** Update UI to support server-side export

**Tasks:**
1. [ ] Update `components/ExportModal.tsx` with export mode selector
2. [ ] Create `components/ExportStatusCard.tsx` for polling
3. [ ] Add polling logic with 2-second interval
4. [ ] Show "you can close browser" message
5. [ ] Add download button when complete
6. [ ] Show retry count and error messages
7. [ ] Add "export history" section to project page

**Deliverables:**
- Users can choose browser vs server export
- Real-time progress updates
- Background processing works (tested by closing browser)

**Testing:**
- Manual test: Start export, close browser, reopen → should show progress
- Manual test: Start export, wait for completion → download works
- Manual test: Trigger failure (invalid clip URL) → shows error message

---

### Phase 6: Production Hardening (Week 6)

**Goal:** Add monitoring, logging, and edge case handling

**Tasks:**
1. [ ] Add Sentry error tracking to Inngest functions
2. [ ] Set up Inngest event log forwarding to Datadog/LogDNA
3. [ ] Add performance monitoring (track export times)
4. [ ] Implement cleanup job for old temp files
5. [ ] Add "cancel export" functionality
6. [ ] Create admin dashboard for export monitoring
7. [ ] Write runbook for handling failed exports

**Deliverables:**
- All errors logged to Sentry
- Performance metrics in dashboard
- Admin can view/cancel in-progress exports

---

## Cost Analysis

### Free Tier Limits

**Vercel Free:**
- 100GB bandwidth/month
- Serverless function: 100GB-hours/month
- No timeout issues (just sends event in < 10s)

**Estimated Usage:**
- Export trigger: < 100ms × 1,000 exports = 100 seconds = $0
- Bandwidth: Sending event is < 1KB × 1,000 = 1MB = $0

**✅ Vercel cost: $0/month**

---

**Inngest Free:**
- 1,000 function runs/month
- Unlimited steps within those runs
- 5 min per step timeout

**Estimated Usage:**
- 30 exports/day × 30 days = 900 runs/month
- Each export = 4 steps (download, process, upload, update)
- Total: 900 runs < 1,000 limit

**✅ Inngest cost: $0/month**

---

**Convex Free:**
- 1GB storage
- 1M reads/month
- 100K writes/month

**Estimated Usage:**
- Storage: 1080p @ 50MB/min → 1GB = 20 min of video
- Writes: 900 exports × 10 updates each = 9,000 writes < 100K
- Reads: Polling at 2s interval × 2 min avg export × 900 = 54,000 reads < 1M

**✅ Convex cost: $0/month**

---

### Scaling Thresholds

**When you'll need to pay:**

| Metric | Free Limit | Hit at | Cost if Exceeded |
|--------|-----------|--------|------------------|
| Inngest runs | 1,000/mo | ~33 exports/day | $20/mo (50k runs) |
| Convex storage | 1GB | ~20 min video | $0.15/GB/mo |
| Convex reads | 1M/mo | 1,500 exports/mo | $2/M reads |

**Recommendation:** Delete exported videos after 7 days to stay under 1GB

---

## Risk Assessment

### Technical Risks

**1. FFmpeg Complexity**
- **Risk:** FFmpeg commands fail with obscure errors
- **Impact:** Exports fail, users frustrated
- **Mitigation:**
  - Extensive testing with various clip combinations
  - Fallback to simpler FFmpeg commands on failure
  - Detailed error logging to debug issues
- **Probability:** Medium
- **Severity:** High

---

**2. Inngest Cloud Execution Time**
- **Risk:** Exports take > 5 min per step (timeout)
- **Impact:** Long videos fail to export
- **Mitigation:**
  - Break into smaller steps (download, process, upload separate)
  - Each step < 5 min even for 10-min video
  - Use Inngest's step.run() to isolate timeouts
- **Probability:** Low
- **Severity:** Medium

---

**3. Replicate URL Expiration**
- **Risk:** Video URLs expire during export queue
- **Impact:** Export fails with "not found" error
- **Mitigation:**
  - Download all clips in first step (< 1 min)
  - Add retry logic with fresh URL fetch
  - Warn users if URLs > 12 hours old
- **Probability:** Medium
- **Severity:** Low

---

**4. Convex Storage Limits**
- **Risk:** Users exceed 1GB free tier
- **Impact:** Uploads fail, blocking exports
- **Mitigation:**
  - Show storage usage in dashboard
  - Auto-delete videos > 7 days old (with warning)
  - Graceful error with upgrade prompt
- **Probability:** High (at scale)
- **Severity:** Low

---

### Business Risks

**1. Free Tier Overage**
- **Risk:** Exceed Inngest 1k runs before monetization
- **Impact:** Unexpected $20/mo cost
- **Mitigation:**
  - Monitor usage in Inngest dashboard
  - Set up alerts at 80% usage
  - Implement rate limiting (5 exports/user/day)
- **Probability:** Medium
- **Severity:** Low ($20 is acceptable)

---

**2. User Expectation Mismatch**
- **Risk:** Users expect instant download, confused by polling
- **Impact:** Poor UX, support tickets
- **Mitigation:**
  - Clear messaging: "Processing in background"
  - Email notification when complete (future)
  - Show estimated time remaining
- **Probability:** Low
- **Severity:** Medium

---

## Open Questions

1. **Should we deprecate browser export entirely?**
   - Recommendation: Keep as fallback for < 1 min videos
   - Mobile users should always use server export

2. **How long to keep exported videos in Convex storage?**
   - Recommendation: 7 days auto-delete with email reminder at day 5
   - Premium users: 30 days retention

3. **Should we add email notifications for export completion?**
   - Recommendation: Yes, Phase 2 feature (after MVP)
   - Use Resend or SendGrid

4. **What's the maximum supported video length?**
   - Recommendation: 10 minutes (soft limit)
   - Hard limit: 5 min per Inngest step × 3 steps = 15 min total

5. **Should we support export presets (social media formats)?**
   - Recommendation: Post-MVP feature
   - Example: Instagram (1080x1080), TikTok (1080x1920), YouTube (1920x1080)

---

## Success Criteria

### MVP Launch Requirements

**Must Have:**
- ✅ Server-side export working for 1080p videos up to 5 minutes
- ✅ Success rate > 90% (internal testing)
- ✅ Polling UI shows real-time progress
- ✅ Users can close browser during export
- ✅ Retry logic handles transient failures
- ✅ Error messages are actionable
- ✅ All code has > 70% test coverage

**Nice to Have:**
- 📋 Export queue visible in UI (show all exports)
- 📋 "Cancel export" button
- 📋 Performance monitoring dashboard
- 📋 Email notification on completion

---

## Appendix

### A. Alternative Architectures Considered

**1. Self-Hosted Inngest on Railway**
- Pros: No vendor lock-in, more control
- Cons: More complex, costs money immediately
- Decision: Use Inngest Cloud for simplicity

**2. Replicate for Video Processing**
- Pros: No FFmpeg complexity
- Cons: No good video editing model exists, expensive
- Decision: Use FFmpeg locally

**3. AWS Lambda + SQS**
- Pros: Industry standard, well-documented
- Cons: Much more setup, no free tier for this use case
- Decision: Too complex for MVP

---

### B. FFmpeg Command Reference

**Basic Concatenation:**
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0:v][1:v]concat=n=2:v=1[outv]" \
  -map "[outv]" output.mp4
```

**With Trim:**
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "\
    [0:v]trim=start=2:duration=5,setpts=PTS-STARTPTS[v0];\
    [1:v]trim=start=0:duration=3,setpts=PTS-STARTPTS[v1];\
    [v0][v1]concat=n=2:v=1[outv]" \
  -map "[outv]" output.mp4
```

**With Scale and Quality:**
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080" \
  -c:v libx264 \
  -preset medium \
  -b:v 5M \
  -pix_fmt yuv420p \
  -movflags +faststart \
  output.mp4
```

---

### C. Monitoring Queries

**Inngest Dashboard Metrics:**
- Function success rate (target: > 95%)
- Average execution time (target: < 120s)
- Error breakdown by step

**Convex Queries:**
```typescript
// Export success rate
const exports = await ctx.db
  .query("finalVideos")
  .filter(q => q.gte(q.field("createdAt"), Date.now() - 7 * 24 * 60 * 60 * 1000))
  .collect();

const successRate = exports.filter(e => e.status === 'complete').length / exports.length;

// Average export time
const completedExports = exports.filter(e => e.completedAt && e.processingStartedAt);
const avgTime = completedExports.reduce((sum, e) =>
  sum + (e.completedAt! - e.processingStartedAt!), 0
) / completedExports.length;
```

---

### D. Deployment Checklist

**Before deploying to production:**
- [ ] All environment variables set in Vercel
- [ ] Inngest signing key configured
- [ ] Convex schema deployed with new fields
- [ ] FFmpeg binary accessible in Inngest environment
- [ ] Rate limiting implemented (5 exports/user/day)
- [ ] Error tracking set up (Sentry)
- [ ] Load testing completed (10 concurrent exports)
- [ ] Rollback plan documented
- [ ] Support team trained on new export flow

**Post-deployment:**
- [ ] Monitor error rates for 24 hours
- [ ] Check Inngest dashboard for failures
- [ ] Verify Convex storage usage
- [ ] Test export on mobile devices
- [ ] Gather user feedback

---

### E. References

**Documentation:**
- [Inngest Documentation](https://www.inngest.com/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Convex Storage Guide](https://docs.convex.dev/file-storage)
- [MediaBunny API](https://mediabunny.dev)

**Similar Implementations:**
- [Remotion Lambda](https://github.com/remotion-dev/lambda) - Video rendering in cloud
- [Shotstack](https://shotstack.io) - Video editing API (paid)

---

## Changelog

**v1.0 - 2025-11-16**
- Initial PRD draft
- Defined architecture and implementation plan
- Cost analysis completed

**Next Review:** 2025-11-23 (after Phase 1 completion)
