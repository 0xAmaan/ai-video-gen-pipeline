# PRD: StreamVideo IndexedDB Implementation

**Version:** 1.0
**Date:** November 16, 2025
**Author:** AI Video Gen Pipeline Team
**Status:** Draft

---

## 1. Executive Summary

### Overview
Implement a CapCut-style video caching system using IndexedDB to enable high-performance, offline-capable video scrubbing in the editor. Currently, videos are streamed directly from Replicate CDN, causing network latency during timeline scrubbing. This implementation will download and chunk videos into IndexedDB for instant local access.

### Problem Statement
- **Current State:** Video scrubbing requires network requests to Replicate CDN (100-500ms latency per seek)
- **User Impact:** Choppy timeline scrubbing, slow preview updates, no offline editing capability
- **Technical Debt:** Thumbnails and waveforms regenerated on every project load due to Convex 1MB limit

### Solution
Implement a three-tier storage architecture:
1. **IndexedDB** - Persistent local storage for video chunks, thumbnails, and waveforms
2. **Memory Cache** - Existing FrameCache for hot frames
3. **Network Fallback** - Replicate CDN as ultimate fallback

### Success Metrics
- Timeline scrubbing latency: **< 50ms** (down from 100-500ms)
- Initial project load time: **< 2s** for cached projects
- Storage efficiency: **< 150MB** per 10-clip project
- Offline editing: **100% functional** for previously loaded projects

---

## 2. Background & Context

### Current Architecture

**Video Playback Flow:**
```
User scrubs timeline
  → PreviewRenderer.seek(time)
  → videoElement.src = asset.url (Replicate CDN)
  → videoElement.currentTime = seekTime
  → Network request (100-500ms)
  → Frame decoded
  → Canvas render
```

**Existing Caching:**
- **FrameCache**: 120 ImageBitmap objects in memory (LRU eviction)
- **ThumbnailCache**: 50 assets in memory (regenerated per session)
- **No persistent storage**: All data lost on page reload

**Current Storage Usage:**
- **Convex DB**: Project metadata, clip structure (stripped of binary data)
- **localStorage**: UI preferences (~1KB)
- **IndexedDB**: NOT USED

### Dependencies
- **MediaBunny** (v1.25.0) - Already integrated for video demuxing/encoding
- **Convex** - Backend for project metadata
- **Zustand** - Frontend state management
- **React Konva** - Canvas-based timeline rendering

### Technical Constraints
- Convex 1MB document size limit (reason for data stripping)
- IndexedDB browser quota (typically 50-500MB, varies by browser)
- Video format: MP4 (H.264 codec) from Replicate
- Video specs: 720p, 30fps, 5-10 second clips

---

## 3. Goals and Non-Goals

### Goals
✅ **Primary:**
- Implement IndexedDB-based video chunk storage
- Download and cache Replicate videos after generation
- Enable instant (<50ms) timeline scrubbing from local cache
- Persist thumbnails and waveforms to avoid regeneration

✅ **Secondary:**
- Implement quota management and automatic cleanup
- Add offline editing capability
- Reduce bandwidth costs for repeat scrubbing
- Improve initial load performance for cached projects

### Non-Goals
❌ **Explicitly Out of Scope:**
- Replace MediaBunny with FFmpeg.wasm
- Implement server-side video caching
- Support video formats other than MP4
- Build custom video codec (use browser WebCodecs)
- Implement real-time video streaming protocol
- Add peer-to-peer video sharing

---

## 4. User Stories

### US-1: Fast Timeline Scrubbing
**As a** video editor user
**I want** smooth, instant timeline scrubbing
**So that** I can quickly preview different parts of my video without lag

**Acceptance Criteria:**
- Timeline scrubbing responds in < 50ms
- No visible delay when hovering over timeline
- Scrubber preview updates in real-time
- Works without internet connection (after initial load)

---

### US-2: Offline Editing
**As a** video editor user
**I want** to edit previously loaded projects offline
**So that** I can work without internet connectivity

**Acceptance Criteria:**
- Projects with cached videos open instantly offline
- All timeline features work offline (scrubbing, playback, trimming)
- Export works offline (if all assets cached)
- Clear UI indication when assets are not cached

---

### US-3: Fast Project Loading
**As a** video editor user
**I want** projects to load instantly when I return to them
**So that** I don't wait for thumbnail/waveform regeneration

**Acceptance Criteria:**
- Cached projects load in < 2 seconds
- Thumbnails appear immediately (no regeneration)
- Waveforms appear immediately (no regeneration)
- No network requests for previously loaded assets

---

### US-4: Transparent Caching
**As a** video editor user
**I want** caching to happen automatically in the background
**So that** I don't need to manually manage storage

**Acceptance Criteria:**
- Videos download automatically after generation
- Progress indicator shows download status
- No manual "download" button required
- Automatic cleanup when storage quota exceeded

---

## 5. Technical Architecture

### 5.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Application                        │
│                                                                   │
│  ┌──────────────────┐        ┌────────────────────────────┐    │
│  │  PreviewRenderer │────────│  VideoAssetManager         │    │
│  │  - seek()        │        │  - loadVideo(assetId)      │    │
│  │  - drawFrame()   │        │  - cacheStatus(assetId)    │    │
│  └──────────────────┘        └────────────────────────────┘    │
│           │                              │                       │
│           │                              │                       │
│  ┌────────▼──────────┐        ┌─────────▼───────────────────┐  │
│  │  FrameCache       │        │  StreamVideoDatabase (NEW)  │  │
│  │  (Memory, 120)    │        │  - getVideoBlob()           │  │
│  └───────────────────┘        │  - putChunks()              │  │
│                                │  - getThumbnails()          │  │
│                                │  - getWaveform()            │  │
│                                └─────────────────────────────┘  │
│                                          │                       │
│                                          │ IndexedDB API         │
│                                          │                       │
│                                ┌─────────▼──────────────────┐   │
│                                │  IndexedDB: stream-video   │   │
│                                │  ┌──────────────────────┐  │   │
│                                │  │ ObjectStore: chunks  │  │   │
│                                │  │ - key (PK)           │  │   │
│                                │  │ - assetId (indexed)  │  │   │
│                                │  │ - offset             │  │   │
│                                │  │ - data (Uint8Array)  │  │   │
│                                │  └──────────────────────┘  │   │
│                                │  ┌──────────────────────┐  │   │
│                                │  │ ObjectStore: thumbs  │  │   │
│                                │  │ - assetId (PK)       │  │   │
│                                │  │ - thumbnails (array) │  │   │
│                                │  └──────────────────────┘  │   │
│                                │  ┌──────────────────────┐  │   │
│                                │  │ ObjectStore: waves   │  │   │
│                                │  │ - assetId (PK)       │  │   │
│                                │  │ - waveform (Float32) │  │   │
│                                │  └──────────────────────┘  │   │
│                                └─────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
         ┌──────────▼──────────┐       ┌───────────▼──────────┐
         │  Replicate CDN      │       │  Convex Database     │
         │  (Video source)     │       │  (Metadata only)     │
         └─────────────────────┘       └──────────────────────┘
```

### 5.2 Data Flow

**Video Download Flow:**
```
1. Replicate generation completes
   └─> Poll prediction API returns videoUrl

2. VideoDownloader.downloadAndCache(videoUrl, assetId)
   ├─> fetch(videoUrl) → Blob
   ├─> Chunk into 512KB blocks
   └─> StreamVideoDatabase.putChunks(chunks)

3. MediaBunnyManager.generateThumbnails()
   ├─> Extract 5 thumbnails
   └─> StreamVideoDatabase.putThumbnails(thumbnails)

4. MediaBunnyManager.demux()
   ├─> Extract waveform
   └─> StreamVideoDatabase.putWaveform(waveform)
```

**Video Playback Flow:**
```
1. User scrubs timeline
   └─> PreviewRenderer.seek(time)

2. VideoAssetManager.loadVideo(assetId)
   ├─> Check FrameCache (memory) → HIT? → Return ImageBitmap
   │
   ├─> Check StreamVideoDatabase → HIT?
   │   ├─> getVideoBlob(assetId)
   │   ├─> Create object URL
   │   └─> videoElement.src = localUrl
   │
   └─> Fallback to network
       ├─> videoElement.src = asset.url (Replicate)
       └─> Background: downloadAndCache()

3. Render frame to canvas
```

### 5.3 Storage Strategy

**Chunking Strategy:**
- **Chunk size:** 512KB (524,288 bytes) - Standard for streaming
- **Naming pattern:** `{assetId}_{totalSize}_{offset}-{chunkSize}`
- **Example:** `asset-123_8945632_0-524288` (first chunk)
- **Rationale:** Matches CapCut's implementation, optimal for IndexedDB read performance

**Eviction Policy:**
- **Strategy:** LRU (Least Recently Used) by project
- **Trigger:** When quota usage > 80%
- **Order:** Delete oldest untouched project's assets first
- **Protection:** Current project assets never evicted

---

## 6. Database Schema

### 6.1 IndexedDB Schema

**Database Name:** `stream-video`
**Version:** 1

#### ObjectStore: `chunks`
```typescript
{
  keyPath: 'key',
  indexes: [
    { name: 'assetId', keyPath: 'assetId', unique: false },
    { name: 'updateTime', keyPath: 'updateTime', unique: false }
  ]
}
```

**Record Structure:**
```typescript
interface VideoChunk {
  key: string;              // PK: "{assetId}_{offset}-{chunkSize}"
  assetId: string;          // Foreign key to MediaAssetMeta.id
  totalSize: number;        // Total video file size in bytes
  offset: number;           // Byte offset of this chunk
  chunkSize: number;        // Size of this chunk (usually 524288)
  data: Uint8Array;         // Binary chunk data
  updateTime: number;       // Timestamp (for LRU eviction)
}
```

**Example Record:**
```json
{
  "key": "asset-abc123_8945632_0-524288",
  "assetId": "asset-abc123",
  "totalSize": 8945632,
  "offset": 0,
  "chunkSize": 524288,
  "data": Uint8Array([...]),
  "updateTime": 1700000000000
}
```

---

#### ObjectStore: `thumbnails`
```typescript
{
  keyPath: 'assetId',
  indexes: [
    { name: 'updateTime', keyPath: 'updateTime', unique: false }
  ]
}
```

**Record Structure:**
```typescript
interface ThumbnailCache {
  assetId: string;          // PK: MediaAssetMeta.id
  thumbnails: string[];     // Array of 5 data URLs (JPEG)
  updateTime: number;       // Timestamp (for LRU eviction)
}
```

**Example Record:**
```json
{
  "assetId": "asset-abc123",
  "thumbnails": [
    "data:image/jpeg;base64,/9j/4AAQ...",
    "data:image/jpeg;base64,/9j/4AAQ...",
    "data:image/jpeg;base64,/9j/4AAQ...",
    "data:image/jpeg;base64,/9j/4AAQ...",
    "data:image/jpeg;base64,/9j/4AAQ..."
  ],
  "updateTime": 1700000000000
}
```

---

#### ObjectStore: `waveforms`
```typescript
{
  keyPath: 'assetId',
  indexes: [
    { name: 'updateTime', keyPath: 'updateTime', unique: false }
  ]
}
```

**Record Structure:**
```typescript
interface WaveformCache {
  assetId: string;          // PK: MediaAssetMeta.id
  waveform: Float32Array;   // Audio waveform data
  sampleRate: number;       // Audio sample rate (usually 44100 or 48000)
  updateTime: number;       // Timestamp (for LRU eviction)
}
```

---

#### ObjectStore: `metadata`
```typescript
{
  keyPath: 'key',
  indexes: []
}
```

**Record Structure:**
```typescript
interface StorageMetadata {
  key: string;              // PK: Always 'quota-info'
  totalUsage: number;       // Total bytes used
  quotaLimit: number;       // Browser quota limit
  assetCount: number;       // Number of cached assets
  lastCleanup: number;      // Last cleanup timestamp
}
```

---

### 6.2 Convex Schema (No Changes)

No modifications to existing Convex schema. All binary data remains local-only.

---

## 7. API Specifications

### 7.1 Core API: `StreamVideoDatabase`

**File:** `lib/editor/storage/stream-video-db.ts`

```typescript
export class StreamVideoDatabase {
  // Initialization
  async init(): Promise<void>;
  async close(): Promise<void>;

  // Video chunks
  async putChunk(chunk: VideoChunk): Promise<void>;
  async putChunks(assetId: string, chunks: VideoChunk[]): Promise<void>;
  async getChunks(assetId: string): Promise<VideoChunk[]>;
  async getVideoBlob(assetId: string): Promise<Blob | null>;
  async hasVideo(assetId: string): Promise<boolean>;
  async deleteVideo(assetId: string): Promise<void>;

  // Thumbnails
  async putThumbnails(assetId: string, thumbnails: string[]): Promise<void>;
  async getThumbnails(assetId: string): Promise<string[] | null>;
  async hasThumbnails(assetId: string): Promise<boolean>;
  async deleteThumbnails(assetId: string): Promise<void>;

  // Waveforms
  async putWaveform(assetId: string, waveform: Float32Array, sampleRate: number): Promise<void>;
  async getWaveform(assetId: string): Promise<{ waveform: Float32Array; sampleRate: number } | null>;
  async hasWaveform(assetId: string): Promise<boolean>;
  async deleteWaveform(assetId: string): Promise<void>;

  // Quota management
  async getQuotaInfo(): Promise<{ usage: number; quota: number; percentage: number }>;
  async cleanupOldAssets(keepAssetIds: string[]): Promise<number>; // Returns bytes freed
  async clearAll(): Promise<void>;

  // Utilities
  async updateAccessTime(assetId: string): Promise<void>; // Touch for LRU
  async getStorageStats(): Promise<StorageStats>;
}
```

---

### 7.2 Video Downloader API

**File:** `lib/editor/storage/video-downloader.ts`

```typescript
export interface DownloadProgress {
  assetId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  status: 'downloading' | 'chunking' | 'storing' | 'complete' | 'error';
  error?: string;
}

export class VideoDownloader {
  // Download and cache video
  async downloadAndCache(
    videoUrl: string,
    assetId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ success: boolean; chunksStored: number; totalSize: number }>;

  // Batch download multiple videos
  async downloadBatch(
    videos: Array<{ url: string; assetId: string }>,
    onProgress?: (assetId: string, progress: DownloadProgress) => void
  ): Promise<DownloadResult[]>;

  // Cancel ongoing download
  async cancelDownload(assetId: string): Promise<void>;

  // Check if video is cached
  async isCached(assetId: string): Promise<boolean>;

  // Get cache status for multiple assets
  async getCacheStatus(assetIds: string[]): Promise<Record<string, CacheStatus>>;
}

export interface CacheStatus {
  cached: boolean;
  size: number;
  chunks: number;
  lastAccessed: number;
}
```

---

### 7.3 Video Asset Manager API

**File:** `lib/editor/storage/video-asset-manager.ts`

```typescript
export class VideoAssetManager {
  // Get video for playback (checks cache, falls back to network)
  async getVideoUrl(assetId: string): Promise<string>; // Returns object URL or network URL

  // Preload video into cache
  async preloadVideo(assetId: string, videoUrl: string): Promise<void>;

  // Preload multiple videos in parallel
  async preloadBatch(assets: Array<{ assetId: string; videoUrl: string }>): Promise<void>;

  // Get thumbnails (cache-first)
  async getThumbnails(assetId: string): Promise<string[] | null>;

  // Get waveform (cache-first)
  async getWaveform(assetId: string): Promise<Float32Array | null>;

  // Evict asset from cache
  async evictAsset(assetId: string): Promise<void>;

  // Get cache statistics
  async getStats(): Promise<CacheStats>;

  // Cleanup unused assets (not in current project)
  async cleanupUnused(currentProjectAssetIds: string[]): Promise<void>;
}

export interface CacheStats {
  totalAssets: number;
  cachedAssets: number;
  totalSize: number;
  quotaUsage: number;
  quotaLimit: number;
}
```

---

## 8. Integration Points

### 8.1 Integration with MediaBunnyManager

**File:** `lib/editor/io/media-bunny-manager.ts`

**Changes Required:**

```typescript
// Current: importFile()
async importFile(file: File): Promise<MediaAssetMeta> {
  const result = await this.worker.demux(file);
  return result;
}

// NEW: importFile() with caching
async importFile(file: File): Promise<MediaAssetMeta> {
  const result = await this.worker.demux(file);

  // Cache thumbnails if available
  if (result.thumbnails) {
    await streamVideoDb.putThumbnails(result.id, result.thumbnails);
  }

  // Cache waveform if available
  if (result.waveform && result.sampleRate) {
    await streamVideoDb.putWaveform(result.id, result.waveform, result.sampleRate);
  }

  // If file has a Blob URL, cache the video
  if (file) {
    const videoBlob = file;
    const chunks = await this.chunkBlob(videoBlob, result.id);
    await streamVideoDb.putChunks(result.id, chunks);
  }

  return result;
}

// NEW: Load thumbnails from cache
async loadThumbnails(assetId: string): Promise<string[] | null> {
  return await streamVideoDb.getThumbnails(assetId);
}

// NEW: Load waveform from cache
async loadWaveform(assetId: string): Promise<Float32Array | null> {
  const result = await streamVideoDb.getWaveform(assetId);
  return result?.waveform || null;
}
```

---

### 8.2 Integration with PreviewRenderer

**File:** `lib/editor/playback/preview-renderer.ts`

**Changes Required:**

```typescript
// Current: syncMediaToTimeline()
private syncMediaToTimeline() {
  const clip = this.resolveClip(sequence, this.currentTime);
  const asset = this.getAsset(clip.mediaId);

  if (this.videoEl.src !== asset.url) {
    this.videoEl.src = asset.url; // Network URL
  }
}

// NEW: syncMediaToTimeline() with IndexedDB
private async syncMediaToTimeline() {
  const clip = this.resolveClip(sequence, this.currentTime);
  const asset = this.getAsset(clip.mediaId);

  // Try to get cached video first
  const cachedUrl = await videoAssetManager.getVideoUrl(asset.id);

  if (this.videoEl.src !== cachedUrl) {
    this.videoEl.src = cachedUrl; // Object URL or network URL
    this.videoEl.currentTime = clip.trimStart;
  }

  // Update access time for LRU
  await streamVideoDb.updateAccessTime(asset.id);
}
```

---

### 8.3 Integration with Project Store

**File:** `lib/editor/core/project-store.ts`

**Changes Required:**

```typescript
// NEW: Add to hydrate() method
async hydrate(projectId: string) {
  // Existing: Load from Convex
  const project = await convex.query(api.editor.getProject, { projectId });

  // NEW: Load thumbnails and waveforms from IndexedDB
  for (const asset of Object.values(project.mediaAssets)) {
    // Load thumbnails
    const thumbnails = await streamVideoDb.getThumbnails(asset.id);
    if (thumbnails) {
      asset.thumbnails = thumbnails;
    }

    // Load waveform
    const waveformData = await streamVideoDb.getWaveform(asset.id);
    if (waveformData) {
      asset.waveform = waveformData.waveform;
      asset.sampleRate = waveformData.sampleRate;
    }
  }

  // Set state
  set({ project, isLoading: false });

  // NEW: Preload videos in background
  const videoAssets = Object.values(project.mediaAssets).filter(a => a.type === 'video');
  videoAssetManager.preloadBatch(
    videoAssets.map(a => ({ assetId: a.id, videoUrl: a.url }))
  ).catch(console.error);
}
```

---

### 8.4 Integration with Video Generation

**File:** `app/api/poll-prediction/route.ts`

**Changes Required:**

```typescript
// Current: Poll endpoint returns video URL
export async function GET(request: NextRequest) {
  const prediction = await replicate.predictions.get(predictionId);

  if (prediction.status === 'succeeded') {
    return NextResponse.json({
      status: 'complete',
      videoUrl: extractVideoUrl(prediction.output)
    });
  }
}

// NEW: Trigger background download after URL available
export async function GET(request: NextRequest) {
  const prediction = await replicate.predictions.get(predictionId);

  if (prediction.status === 'succeeded') {
    const videoUrl = extractVideoUrl(prediction.output);

    // Return immediately
    const response = NextResponse.json({
      status: 'complete',
      videoUrl
    });

    // Trigger background download (fire-and-forget)
    // Note: This happens on client side, not server

    return response;
  }
}
```

**Client-side (VideoGeneratingPhase.tsx):**

```typescript
// NEW: Download after video URL received
useEffect(() => {
  if (clip.status === 'complete' && clip.videoUrl) {
    // Background download and cache
    videoDownloader.downloadAndCache(clip.videoUrl, clip.id, (progress) => {
      // Optional: Show download progress
      console.log(`Downloading ${clip.id}: ${progress.percentage}%`);
    }).catch(console.error);
  }
}, [clip.status, clip.videoUrl]);
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

**Tasks:**
- [ ] Create `StreamVideoDatabase` class with IndexedDB wrapper
- [ ] Implement database schema (chunks, thumbnails, waveforms, metadata)
- [ ] Write unit tests for database operations
- [ ] Implement quota management utilities
- [ ] Create `VideoDownloader` class with chunking logic

**Deliverables:**
- `lib/editor/storage/stream-video-db.ts`
- `lib/editor/storage/video-downloader.ts`
- `lib/editor/storage/quota-manager.ts`
- Unit tests with 80%+ coverage

**Acceptance Criteria:**
- ✅ Can store and retrieve video chunks
- ✅ Can store and retrieve thumbnails
- ✅ Can store and retrieve waveforms
- ✅ Quota info accurate within 5%
- ✅ LRU eviction works correctly

---

### Phase 2: Video Asset Manager (Week 2)

**Tasks:**
- [ ] Create `VideoAssetManager` class
- [ ] Implement cache-first video loading
- [ ] Implement network fallback logic
- [ ] Add progress tracking for downloads
- [ ] Integrate with existing `MediaBunnyManager`

**Deliverables:**
- `lib/editor/storage/video-asset-manager.ts`
- Integration with `lib/editor/io/media-bunny-manager.ts`
- Progress UI component for download status

**Acceptance Criteria:**
- ✅ Cached videos load in < 50ms
- ✅ Network fallback works when cache miss
- ✅ Download progress reported accurately
- ✅ Parallel downloads work (3+ simultaneous)
- ✅ Thumbnails/waveforms load from cache

---

### Phase 3: Preview Renderer Integration (Week 3)

**Tasks:**
- [ ] Update `PreviewRenderer` to use `VideoAssetManager`
- [ ] Implement object URL management (create/revoke)
- [ ] Add cache hit/miss metrics
- [ ] Update `FrameCache` to work with IndexedDB
- [ ] Test scrubbing performance

**Deliverables:**
- Updated `lib/editor/playback/preview-renderer.ts`
- Performance metrics dashboard updates
- Scrubbing latency measurements

**Acceptance Criteria:**
- ✅ Timeline scrubbing < 50ms for cached videos
- ✅ No memory leaks from object URLs
- ✅ Smooth 60fps scrubbing
- ✅ Works offline for cached projects
- ✅ Fallback to network seamless

---

### Phase 4: Project Store Integration (Week 4)

**Tasks:**
- [ ] Update `project-store.ts` hydrate() with cache loading
- [ ] Add background preloading after project load
- [ ] Update save logic to cache thumbnails/waveforms
- [ ] Add cleanup on project close
- [ ] Test load performance

**Deliverables:**
- Updated `lib/editor/core/project-store.ts`
- Load time measurements
- Cache effectiveness metrics

**Acceptance Criteria:**
- ✅ Cached projects load in < 2s
- ✅ Thumbnails appear instantly (no regeneration)
- ✅ Waveforms appear instantly (no regeneration)
- ✅ Background preloading doesn't block UI
- ✅ Unused assets cleaned up on project switch

---

### Phase 5: Video Generation Integration (Week 5)

**Tasks:**
- [ ] Add auto-download after Replicate generation
- [ ] Update `VideoGeneratingPhase.tsx` with download progress
- [ ] Implement retry logic for failed downloads
- [ ] Add "Download All" manual button as fallback
- [ ] Test with slow network conditions

**Deliverables:**
- Updated `components/VideoGeneratingPhase.tsx`
- Download progress UI
- Network error handling

**Acceptance Criteria:**
- ✅ Videos auto-download after generation
- ✅ Progress shown in UI (percentage)
- ✅ Failed downloads retry 3 times
- ✅ Manual download button works
- ✅ Handles network interruptions gracefully

---

### Phase 6: Quota Management & Cleanup (Week 6)

**Tasks:**
- [ ] Implement automatic cleanup when quota > 80%
- [ ] Add storage usage dashboard
- [ ] Create manual "Clear Cache" button
- [ ] Add per-project storage stats
- [ ] Test quota limit scenarios

**Deliverables:**
- Storage dashboard UI (`components/StorageDashboard.tsx`)
- Automatic cleanup logic
- Manual cleanup controls

**Acceptance Criteria:**
- ✅ Auto-cleanup triggers at 80% quota
- ✅ Current project assets protected
- ✅ LRU eviction works correctly
- ✅ Storage dashboard shows accurate stats
- ✅ Manual clear works (with confirmation)

---

## 10. Testing Requirements

### 10.1 Unit Tests

**File:** `lib/editor/storage/__tests__/stream-video-db.test.ts`

```typescript
describe('StreamVideoDatabase', () => {
  describe('Video Chunks', () => {
    it('should store and retrieve video chunks', async () => {});
    it('should reconstruct blob from chunks in correct order', async () => {});
    it('should handle missing chunks gracefully', async () => {});
    it('should update access time on read', async () => {});
  });

  describe('Thumbnails', () => {
    it('should store and retrieve thumbnails', async () => {});
    it('should return null for missing thumbnails', async () => {});
    it('should overwrite existing thumbnails', async () => {});
  });

  describe('Waveforms', () => {
    it('should store and retrieve waveforms with sample rate', async () => {});
    it('should handle Float32Array correctly', async () => {});
  });

  describe('Quota Management', () => {
    it('should report accurate quota usage', async () => {});
    it('should cleanup oldest assets when quota exceeded', async () => {});
    it('should protect assets in keepList from cleanup', async () => {});
  });
});
```

**File:** `lib/editor/storage/__tests__/video-downloader.test.ts`

```typescript
describe('VideoDownloader', () => {
  it('should download and chunk video', async () => {});
  it('should report progress during download', async () => {});
  it('should handle network errors', async () => {});
  it('should retry failed downloads', async () => {});
  it('should cancel ongoing downloads', async () => {});
  it('should detect already cached videos', async () => {});
});
```

---

### 10.2 Integration Tests

**File:** `lib/editor/playback/__tests__/preview-renderer.integration.test.ts`

```typescript
describe('PreviewRenderer with IndexedDB', () => {
  it('should load video from cache on first seek', async () => {});
  it('should fall back to network when cache miss', async () => {});
  it('should cache video after network load', async () => {});
  it('should scrub smoothly with cached video', async () => {});
  it('should work offline with cached assets', async () => {});
});
```

---

### 10.3 Performance Tests

**Metrics to Measure:**
- Timeline scrubbing latency (target: < 50ms)
- Project load time (target: < 2s for cached)
- Download speed (baseline: measure with 10MB video)
- IndexedDB read speed (baseline: 512KB chunk)
- IndexedDB write speed (baseline: 512KB chunk)
- Memory usage (should not exceed 500MB)

**Test Cases:**
- Scrub through 10-second video 100 times, measure average latency
- Load project with 10 cached videos, measure time to interactive
- Download 100MB video, measure time and consistency
- Simulate quota limit, verify cleanup works
- Test with slow 3G network (throttled)

---

### 10.4 Edge Cases to Test

1. **Quota Exceeded:**
   - Browser runs out of IndexedDB quota
   - Verify graceful degradation to network-only mode
   - Verify user notification

2. **Partial Download:**
   - Network interrupted mid-download
   - Verify chunks cleaned up
   - Verify retry works

3. **Corrupted Data:**
   - Invalid chunk data in IndexedDB
   - Verify fallback to network
   - Verify corrupted asset deleted

4. **Browser Compatibility:**
   - Test on Chrome, Firefox, Safari, Edge
   - Verify IndexedDB support detection
   - Verify fallback when IndexedDB unavailable

5. **Concurrent Access:**
   - Multiple tabs open same project
   - Verify no database locking issues
   - Verify data consistency

6. **Large Projects:**
   - Project with 50+ video clips
   - Verify preloading doesn't block UI
   - Verify memory doesn't leak

7. **Mixed Cache State:**
   - Some assets cached, some not
   - Verify UI shows correct status
   - Verify playback smooth across transition

---

## 11. UI/UX Requirements

### 11.1 Download Progress Indicator

**Location:** `VideoGeneratingPhase.tsx` - Below video preview

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ Clip 1: "Hero Shot"                     │
│ [████████████░░░░░░░░] 65% cached       │
└─────────────────────────────────────────┘
```

**States:**
- `not-started` - Gray, "Not cached"
- `downloading` - Blue progress bar, "Downloading... 45%"
- `cached` - Green checkmark, "Cached"
- `error` - Red icon, "Download failed (Retry)"

---

### 11.2 Storage Dashboard

**Location:** New modal - `components/StorageDashboard.tsx`

**Access:** Settings menu → "Storage Management"

**Content:**
```
┌─────────────────────────────────────────────────┐
│  Storage Usage                                  │
│                                                 │
│  [████████████████░░] 125 MB / 150 MB (83%)    │
│                                                 │
│  Cached Assets: 12 videos                      │
│  Last Cleanup: 2 hours ago                      │
│                                                 │
│  By Project:                                    │
│  • Project A: 45 MB (5 videos)                 │
│  • Project B: 38 MB (4 videos)                 │
│  • Project C: 42 MB (3 videos)                 │
│                                                 │
│  [Clear All Cache] [Clear Unused Projects]     │
└─────────────────────────────────────────────────┘
```

---

### 11.3 Offline Indicator

**Location:** Top bar (next to project title)

**Visual:**
```
[📡 Offline Mode] - Green when all assets cached
[⚠️ Some assets uncached] - Yellow when partial
[🌐 Online] - Gray when online with uncached assets
```

---

### 11.4 Cache Status Icons (Timeline)

**Location:** KonvaClipItem (top-right corner)

**Visual:**
```
┌─────────────────┐
│ Clip Name   ✓   │  ✓ = Cached (green)
│ [Thumbnail]     │  ↓ = Downloading (blue, animated)
│                 │  ⚠ = Not cached (yellow)
└─────────────────┘  ✗ = Error (red)
```

---

## 12. Performance Optimization Strategies

### 12.1 Chunking Strategy

**Why 512KB chunks?**
- IndexedDB optimal read size: 100KB - 1MB
- Network transfer efficiency: ~500KB per request
- Memory overhead: Small enough to fit many in RAM
- Seek precision: Fine-grained enough for frame-accurate seeking

**Alternative considered:**
- 1MB chunks: Larger, but slower reads on seek
- 256KB chunks: More granular, but more overhead

---

### 12.2 Parallel Download Strategy

**Configuration:**
```typescript
const DOWNLOAD_CONFIG = {
  maxConcurrent: 3,        // 3 videos downloading simultaneously
  chunkBatchSize: 5,       // Store 5 chunks per IndexedDB transaction
  retryAttempts: 3,        // Retry failed downloads 3 times
  retryDelay: 1000,        // 1s delay between retries
  timeout: 30000,          // 30s timeout per download
};
```

**Rationale:**
- 3 concurrent: Balance between speed and browser limits
- Batch writes: Reduce IndexedDB transaction overhead
- Retry logic: Handle transient network errors

---

### 12.3 Preloading Strategy

**When to preload:**
1. After project load (background, low priority)
2. After video generation completes (immediate)
3. On project switch (preload new project assets)

**Priority Order:**
1. Current clip being viewed
2. Clips within ±5 seconds of playhead
3. All clips in current track
4. Clips in other tracks

**Implementation:**
```typescript
async function preloadByPriority(clips: Clip[], currentTime: number) {
  // Sort clips by distance from playhead
  const sorted = clips.sort((a, b) => {
    const distA = Math.abs(a.start - currentTime);
    const distB = Math.abs(b.start - currentTime);
    return distA - distB;
  });

  // Preload in order (max 3 concurrent)
  for (const clip of sorted) {
    await videoAssetManager.preloadVideo(clip.mediaId, clip.videoUrl);
  }
}
```

---

### 12.4 Memory Management

**Object URL Lifecycle:**
```typescript
// Create object URL
const objectUrl = URL.createObjectURL(blob);
videoElement.src = objectUrl;

// Revoke when done (prevent memory leak)
videoElement.addEventListener('loadeddata', () => {
  URL.revokeObjectURL(objectUrl);
});
```

**Max Simultaneous Object URLs:** 10
- Prevents memory bloat
- Older URLs revoked when limit exceeded

---

## 13. Error Handling & Fallback Strategy

### 13.1 Error Types

| Error Type | Cause | Fallback Strategy | User Message |
|------------|-------|-------------------|--------------|
| `QuotaExceededError` | IndexedDB full | Auto-cleanup → Network fallback | "Storage full. Oldest projects cleared." |
| `NetworkError` | Download failed | Retry 3x → Network playback | "Download failed. Playing from network." |
| `CorruptedDataError` | Invalid chunk | Delete asset → Re-download | "Video corrupted. Re-downloading..." |
| `UnsupportedBrowser` | No IndexedDB | Network-only mode | "Cache unavailable. Using network mode." |
| `AbortError` | User cancelled | Stop download, keep partial | "Download cancelled." |

---

### 13.2 Graceful Degradation

**Priority Levels:**
1. **Level 1 (Best):** Cached video + thumbnails + waveform
2. **Level 2 (Good):** Network video + cached thumbnails + waveform
3. **Level 3 (Acceptable):** Network video + regenerated thumbnails/waveform
4. **Level 4 (Fallback):** Network video only (current behavior)

**Transition Logic:**
```typescript
async function getVideoPlaybackMode(assetId: string): Promise<PlaybackMode> {
  const hasVideo = await streamVideoDb.hasVideo(assetId);
  const hasThumbs = await streamVideoDb.hasThumbnails(assetId);
  const hasWave = await streamVideoDb.hasWaveform(assetId);

  if (hasVideo && hasThumbs && hasWave) return 'level-1';
  if (hasThumbs && hasWave) return 'level-2';
  if (asset.url) return 'level-3';
  return 'level-4';
}
```

---

## 14. Security & Privacy Considerations

### 14.1 Data Privacy

**Concerns:**
- Videos contain user-generated content
- IndexedDB accessible to any script on same origin
- Potential for data exfiltration

**Mitigations:**
- No sensitive user data stored (just project videos)
- IndexedDB isolated per origin (secure by default)
- No third-party scripts with storage access

---

### 14.2 Quota Security

**Concerns:**
- Malicious scripts could fill quota
- User quota exhaustion denial-of-service

**Mitigations:**
- Automatic cleanup prevents unbounded growth
- Quota monitoring alerts user before full
- Manual clear cache option available

---

### 14.3 Video URL Security

**Concerns:**
- Object URLs could leak to other contexts
- Replicate URLs are public (not a concern here)

**Mitigations:**
- Object URLs revoked after use
- Replicate URLs already public (signed, time-limited)

---

## 15. Monitoring & Analytics

### 15.1 Metrics to Track

**Performance Metrics:**
- Average scrubbing latency (p50, p95, p99)
- Cache hit rate (%)
- Download success rate (%)
- Project load time (cached vs uncached)

**Usage Metrics:**
- Number of cached assets per user
- Total storage used per user
- Cache eviction frequency
- Network fallback frequency

**Error Metrics:**
- Download failure rate
- Quota exceeded events
- Corrupted data incidents

---

### 15.2 Logging Strategy

**Log Levels:**
- `DEBUG`: IndexedDB operations, cache hits/misses
- `INFO`: Download started/completed, cleanup events
- `WARN`: Network fallbacks, quota warnings
- `ERROR`: Download failures, corrupted data, quota exceeded

**Example Log:**
```typescript
{
  level: 'INFO',
  event: 'video_download_complete',
  assetId: 'asset-abc123',
  duration: 5234, // ms
  size: 8945632, // bytes
  chunks: 18,
  timestamp: 1700000000000
}
```

---

### 15.3 Performance Dashboard Updates

**New Metrics to Display:**
- Cache hit rate (gauge)
- Average scrubbing latency (line chart)
- Storage usage over time (area chart)
- Download queue status (list)

**Location:** Existing `PerformanceDashboard.tsx` component

---

## 16. Rollout Plan

### Phase 1: Alpha (Internal Testing)
- **Duration:** 1 week
- **Users:** Development team only
- **Feature Flag:** `ENABLE_INDEXEDDB_CACHE=true` (env var)
- **Monitoring:** Intensive logging, manual testing
- **Rollback Plan:** Disable feature flag

### Phase 2: Beta (Limited Users)
- **Duration:** 2 weeks
- **Users:** 10% of users (randomly selected)
- **Feature Flag:** Gradual rollout via LaunchDarkly
- **Monitoring:** Automated error tracking, user feedback
- **Success Criteria:** <1% error rate, 80%+ cache hit rate

### Phase 3: General Availability
- **Duration:** Ongoing
- **Users:** 100%
- **Monitoring:** Continued tracking of KPIs
- **Documentation:** User guide, troubleshooting docs

---

## 17. Success Criteria & KPIs

### Must-Have (P0)
- ✅ Timeline scrubbing latency < 50ms (cached videos)
- ✅ Project load time < 2s (cached projects)
- ✅ Cache hit rate > 70% after 1 week of use
- ✅ Zero data loss or corruption incidents
- ✅ Graceful fallback to network (100% uptime)

### Should-Have (P1)
- ✅ Download success rate > 95%
- ✅ Storage usage < 150MB per 10-clip project
- ✅ Automatic cleanup works (quota never exceeded)
- ✅ Offline editing works for 90%+ use cases

### Nice-to-Have (P2)
- ✅ Download speed > 5MB/s (on fast network)
- ✅ Cache hit rate > 90% after 1 month of use
- ✅ User-reported performance improvement

---

## 18. Open Questions & Decisions Needed

### Q1: Should we cache audio separately?
**Options:**
- A) Cache audio + video together (simpler)
- B) Cache audio separately (more granular eviction)

**Recommendation:** A (simpler, audio is small relative to video)

---

### Q2: What's the default quota limit?
**Options:**
- A) Use browser default (varies: 50-500MB)
- B) Request persistent storage (unlimited)
- C) Set app limit (e.g., 200MB)

**Recommendation:** C (200MB app limit with auto-cleanup)

---

### Q3: Should we compress chunks?
**Options:**
- A) Store raw chunks (faster read/write)
- B) Compress chunks (save space, slower read/write)

**Recommendation:** A (video already compressed, additional compression marginal)

---

### Q4: Sync cache across devices?
**Options:**
- A) Local cache only (no sync)
- B) Sync via Convex (complex, expensive)

**Recommendation:** A (out of scope for v1, could revisit in v2)

---

## 19. Future Enhancements (Post-V1)

### V2: Advanced Features
- [ ] Progressive video loading (play while downloading)
- [ ] Service Worker integration for true offline PWA
- [ ] WebRTC P2P video sharing between tabs
- [ ] Video compression in IndexedDB (WebAssembly codec)
- [ ] Smart preloading based on user behavior (ML)

### V3: Multi-Device Sync
- [ ] Sync cache across user's devices via Convex
- [ ] Selective sync (download on WiFi only)
- [ ] Cache warming on new device login

---

## 20. Appendix

### A. Browser Compatibility Matrix

| Browser | IndexedDB | WebCodecs | Object URLs | Status |
|---------|-----------|-----------|-------------|--------|
| Chrome 94+ | ✅ | ✅ | ✅ | Fully Supported |
| Firefox 130+ | ✅ | ✅ | ✅ | Fully Supported |
| Safari 17.4+ | ✅ | ✅ | ✅ | Fully Supported |
| Edge 94+ | ✅ | ✅ | ✅ | Fully Supported |
| Chrome <94 | ✅ | ❌ | ✅ | Partial (no MediaBunny) |

---

### B. File Structure

```
lib/editor/storage/
├── stream-video-db.ts          # Core IndexedDB wrapper
├── video-downloader.ts          # Download & chunking logic
├── video-asset-manager.ts       # High-level cache API
├── quota-manager.ts             # Quota monitoring & cleanup
├── types.ts                     # TypeScript interfaces
└── __tests__/
    ├── stream-video-db.test.ts
    ├── video-downloader.test.ts
    └── video-asset-manager.test.ts

components/
├── StorageDashboard.tsx         # Storage usage UI
└── DownloadProgress.tsx         # Download status widget
```

---

### C. Performance Baselines

**Current (Network-Based):**
- Timeline scrubbing: 100-500ms
- Project load: 5-10s (with thumbnail regeneration)
- Offline: Not supported

**Target (IndexedDB-Based):**
- Timeline scrubbing: <50ms
- Project load: <2s (cached)
- Offline: Fully supported

---

### D. Glossary

- **Chunk:** 512KB segment of video file
- **Object URL:** `blob:` URL created from Blob object
- **LRU:** Least Recently Used (eviction strategy)
- **IndexedDB:** Browser's key-value database for large data
- **WebCodecs:** Browser API for hardware-accelerated video decode/encode
- **MediaBunny:** TypeScript library wrapping WebCodecs
- **Quota:** Browser storage limit (usually 50-500MB)

---

### E. References

- [IndexedDB API Spec](https://www.w3.org/TR/IndexedDB/)
- [WebCodecs API](https://www.w3.org/TR/webcodecs/)
- [MediaBunny Documentation](https://mediabunny.dev/)
- [CapCut Web Architecture Analysis](internal document)
- [Storage for the Web (web.dev)](https://web.dev/storage-for-the-web/)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-16 | AI Video Gen Team | Initial PRD |

---

**END OF DOCUMENT**
