# Export Pipeline Test Plan

## Overview
This document outlines the test plan for the high-resolution export pipeline, which implements WebCodecs-based encoding with MediaBunny for MP4 output.

## Test Environment Setup

### Prerequisites
- Modern browser with WebCodecs support (Chrome 94+, Edge 94+)
- Project with video clips in the timeline
- Sufficient disk space for export files

### Test Data Requirements
1. **Simple Project**: 1-2 video clips, 5-10 seconds duration
2. **Complex Project**: Multiple video clips, images, audio tracks, 30+ seconds
3. **Audio-Only Project**: Multiple audio clips, no video
4. **Mixed Media**: Videos, images, and audio combined

## Test Cases

### 1. Basic Export Functionality

#### Test 1.1: Simple Video Export (1080p)
**Steps:**
1. Open a project with at least one video clip in the timeline
2. Click the Export button in the editor
3. Select settings:
   - Resolution: 1080p
   - Quality: High
   - Format: MP4
   - Aspect Ratio: 16:9
4. Click "Start Export"
5. Wait for export to complete

**Expected Results:**
- ✅ Export modal shows progress updates
- ✅ Progress bar advances from 0% to 100%
- ✅ Status messages update (e.g., "Rendering 0.5s", "Mixing audio", "Finalizing file")
- ✅ File downloads automatically when complete
- ✅ Downloaded file is playable
- ✅ Video matches timeline content
- ✅ Resolution is 1920x1080

**File Location:** `export.mp4` (or custom name)

---

#### Test 1.2: Resolution Variations
**Steps:**
1. Export the same project at different resolutions:
   - 720p (1280x720)
   - 1080p (1920x1080)
   - 1440p (2560x1440)
   - 4K (3840x2160)

**Expected Results:**
- ✅ Each export completes successfully
- ✅ File sizes increase with resolution
- ✅ Output dimensions match selected resolution
- ✅ Higher resolutions show better quality

**Verification:**
```bash
# Check video dimensions (macOS)
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 export.mp4
```

---

#### Test 1.3: Quality Settings
**Steps:**
1. Export at 1080p with different quality settings:
   - Low (45% base bitrate)
   - Medium (70% base bitrate)
   - High (100% base bitrate)

**Expected Results:**
- ✅ File size: Low < Medium < High
- ✅ Visual quality differences noticeable
- ✅ High quality provides best detail

**Bitrate Expectations (1080p):**
- Low: ~5.4 Mbps
- Medium: ~8.4 Mbps
- High: ~12 Mbps

---

### 2. Advanced Export Scenarios

#### Test 2.1: Multiple Video Clips
**Steps:**
1. Create a timeline with 3+ video clips
2. Arrange clips sequentially
3. Export at 1080p, High quality

**Expected Results:**
- ✅ All clips render in correct order
- ✅ Transitions between clips are smooth
- ✅ No dropped frames at clip boundaries
- ✅ Timing matches timeline exactly

---

#### Test 2.2: Image + Video Mixed Timeline
**Steps:**
1. Add both image clips and video clips to timeline
2. Export at 1080p

**Expected Results:**
- ✅ Images render at full quality
- ✅ Images scale correctly (cover fit)
- ✅ Videos decode properly
- ✅ No visual artifacts at transitions

---

#### Test 2.3: Audio Mixing
**Steps:**
1. Create timeline with multiple audio clips
2. Set different volume levels (e.g., 0.5, 1.0, 0.8)
3. Export at 1080p, High quality

**Expected Results:**
- ✅ All audio clips are mixed into output
- ✅ Volume levels match timeline settings
- ✅ Audio synchronizes with video
- ✅ No audio clipping or distortion
- ✅ Output audio: 48kHz, stereo, AAC

**Audio Bitrates:**
- Low: 128 kbps
- Medium: 192 kbps
- High: 256 kbps

---

#### Test 2.4: Trimmed Clips
**Steps:**
1. Add video clip with trim start and trim end values
2. Verify timeline shows correct trimmed duration
3. Export

**Expected Results:**
- ✅ Only visible portion of clip appears in export
- ✅ Trim start/end respected exactly
- ✅ No unwanted footage included

---

### 3. Performance & Progress Tracking

#### Test 3.1: Progress Updates
**Steps:**
1. Export a 30+ second video
2. Observe progress modal

**Expected Results:**
- ✅ Progress updates regularly (every ~4% for 25 updates)
- ✅ Status text updates with current time (e.g., "Rendering 2.5s")
- ✅ Progress jumps to 92% for "Mixing audio"
- ✅ Final step shows "Finalizing file" at 95%
- ✅ Completes at 100%

---

#### Test 3.2: Export Cancellation
**Steps:**
1. Start an export
2. Close the export modal or navigate away
3. Check browser console for errors

**Expected Results:**
- ✅ Export worker receives cancel message
- ✅ Export stops gracefully
- ✅ No memory leaks
- ✅ Can start new export immediately

---

### 4. Edge Cases & Error Handling

#### Test 4.1: Empty Timeline
**Steps:**
1. Create project with no clips
2. Attempt to export

**Expected Results:**
- ✅ Export generates black frame or shows warning
- ✅ No crashes or errors

---

#### Test 4.2: Very Short Duration (< 1 second)
**Steps:**
1. Create timeline with single 0.5s clip
2. Export

**Expected Results:**
- ✅ Exports successfully
- ✅ Output duration matches timeline
- ✅ At least 1 frame rendered (at 30fps: 15 frames)

---

#### Test 4.3: Very Long Duration (5+ minutes)
**Steps:**
1. Create timeline with 5+ minutes of content
2. Export at 1080p

**Expected Results:**
- ✅ Export completes without timeout
- ✅ Progress updates throughout
- ✅ File size proportional to duration
- ✅ No memory issues

---

#### Test 4.4: Missing Asset URLs
**Steps:**
1. Create project with asset that has invalid/missing URL
2. Export

**Expected Results:**
- ✅ Export handles error gracefully
- ✅ Skips broken asset or renders placeholder
- ✅ Console shows warning (not crash)
- ✅ Other clips render correctly

---

### 5. Browser Compatibility

#### Test 5.1: Chrome/Edge (Chromium)
**Steps:**
1. Test all basic exports in Chrome 94+
2. Test in Microsoft Edge

**Expected Results:**
- ✅ All features work perfectly
- ✅ WebCodecs fully supported
- ✅ VideoTexture zero-copy works

---

#### Test 5.2: Safari (Limited Support)
**Steps:**
1. Attempt export in Safari

**Expected Results:**
- ⚠️ May fall back to ImageBitmap path
- ⚠️ VideoFrame support limited
- ✅ Should still export (with degraded performance)
- ✅ Or show clear error message

---

### 6. Integration Tests

#### Test 6.1: Round-Trip Export
**Steps:**
1. Create project with specific content
2. Export at 1080p
3. Re-import exported file as new asset
4. Compare to original

**Expected Results:**
- ✅ Exported file can be re-imported
- ✅ Visual quality remains high
- ✅ No generation loss visible
- ✅ Audio remains in sync

---

#### Test 6.2: File System Access API
**Steps:**
1. Export video
2. Check browser's download location

**Expected Results:**
- ✅ File saves with correct name (project title + .mp4)
- ✅ File is immediately playable
- ✅ No corruption

---

## Performance Benchmarks

### Expected Export Times (1080p, 30fps, High Quality)

| Duration | Expected Time | Frames | Notes |
|----------|--------------|--------|-------|
| 10s | ~15-25s | 300 | Simple timeline |
| 30s | ~45-75s | 900 | Multiple clips |
| 60s | ~90-150s | 1800 | Complex project |
| 300s (5m) | ~7-12 min | 9000 | Long form content |

**Factors affecting speed:**
- CPU performance
- GPU capabilities
- Source video codec complexity
- Number of clips/layers
- Audio mixing complexity

---

## Zero-Copy Pipeline Verification

### Test 7.1: Verify Zero-Copy is Active
**Steps:**
1. Open DevTools Console
2. Check `webgpu-preview-renderer.ts` logs
3. Look for VideoTexture usage

**Expected Results:**
- ✅ `useZeroCopy = true` in code
- ✅ No `createImageBitmap()` calls in render path
- ✅ Textures created from VideoFrame directly
- ✅ Memory usage stays low during playback

---

### Test 7.2: Performance Comparison
**Comparison:** Old (ImageBitmap) vs New (VideoTexture)

| Metric | ImageBitmap (Old) | VideoTexture (New) |
|--------|-------------------|-------------------|
| Frame Upload | ~15ms | ~0ms |
| Memory Copies | 2 (CPU + GPU) | 1 (GPU only) |
| Memory Usage | High | ~40% lower |
| GPU Utilization | Low | High (better) |

**Note:** To test old path, set `useZeroCopy = false` in `webgpu-preview-renderer.ts:20`

---

## Common Issues & Troubleshooting

### Issue 1: Export Progress Stuck at 0%
**Possible Causes:**
- Worker not initialized
- OffscreenCanvas not supported
- Asset loading failure

**Debug Steps:**
1. Open DevTools Console
2. Check for errors in `encode-worker.ts`
3. Verify OffscreenCanvas support: `typeof OffscreenCanvas !== 'undefined'`

---

### Issue 2: Audio Not in Export
**Possible Causes:**
- No audio clips in timeline
- Audio volume set to 0
- Audio track disabled

**Debug Steps:**
1. Verify `hasAudio(sequence)` returns true
2. Check audio clips have `kind === "audio"`
3. Verify volume > 0

---

### Issue 3: Video Frame Decode Errors
**Possible Causes:**
- Unsupported codec
- Corrupted source file
- Network timeout

**Debug Steps:**
1. Check console for "Video decode failed" warnings
2. Verify asset URL is accessible
3. Try re-uploading source file

---

### Issue 4: Export File Won't Play
**Possible Causes:**
- Export interrupted
- Codec not supported by player
- Incomplete muxing

**Debug Steps:**
1. Check file size (should be > 0 bytes)
2. Try different video player (VLC, QuickTime)
3. Use ffprobe to check file integrity:
```bash
ffprobe export.mp4
```

---

## Automated Testing (Future)

### Unit Tests to Implement
- `ExportPipeline.exportProject()` - mock worker communication
- `renderFrame()` - verify correct clip selection at various times
- `mixClipIntoBuffers()` - audio mixing accuracy
- `resampleChannel()` - sample rate conversion correctness

### Integration Tests
- Full export with mock assets
- Progress callback invocation
- Cancel mid-export cleanup

---

## Sign-Off Checklist

Before marking export as production-ready:

- [ ] All basic export tests pass (1.1-1.3)
- [ ] Advanced scenarios work (2.1-2.4)
- [ ] Progress tracking accurate (3.1-3.2)
- [ ] Edge cases handled gracefully (4.1-4.4)
- [ ] Tested in Chrome/Edge
- [ ] Performance meets benchmarks
- [ ] Zero-copy pipeline verified
- [ ] Audio mixing correct
- [ ] No memory leaks observed
- [ ] Files play in multiple players

---

## Test Execution Log

Use this section to record test results:

| Test ID | Date | Tester | Result | Notes |
|---------|------|--------|--------|-------|
| 1.1 | | | ⬜ Pass / ❌ Fail | |
| 1.2 | | | ⬜ Pass / ❌ Fail | |
| 1.3 | | | ⬜ Pass / ❌ Fail | |
| 2.1 | | | ⬜ Pass / ❌ Fail | |
| 2.2 | | | ⬜ Pass / ❌ Fail | |
| 2.3 | | | ⬜ Pass / ❌ Fail | |
| 2.4 | | | ⬜ Pass / ❌ Fail | |

---

## Quick Start Testing Guide

**Fastest way to test export:**

1. **Start dev server:**
   ```bash
   bun run dev
   ```

2. **Open editor:**
   - Navigate to `http://localhost:3000/projects/{projectId}/editor`
   - Or create new project and add clips

3. **Add test content:**
   - Upload 1-2 short video files (10-30s each)
   - Drag to timeline
   - Optionally add audio

4. **Export:**
   - Click Export button
   - Select 1080p, High quality
   - Click "Start Export"
   - Monitor progress

5. **Verify output:**
   - Download completes
   - File plays in browser/VLC
   - Content matches timeline
   - Audio in sync (if applicable)

**Expected result:** Clean export in ~2-3x real-time (30s video → ~60-90s export)

---

**Test Plan Version:** 1.0  
**Last Updated:** 2025-01-21  
**Related PRD:** `.taskmaster/docs/prd.md` (Task 10: High-Resolution Export Pipeline)
