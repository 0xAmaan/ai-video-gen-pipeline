# Multitrack Implementation Guide

## Completed Phases (1-4)

### Phase 1: Data Model ✅
- Extended types with `BlendMode`, track fields (`name`, `solo`, `zIndex`, `height`, `visible`)
- Project store actions: `addTrack`, `removeTrack`, `updateTrack`, `detachAudio`, `linkClips`, `splitClipAtTime`
- AudioMixer class for multi-track audio mixing

### Phase 2: Timeline UI ✅
- TrackHeader component with mute/solo/lock/visible/volume controls
- Variable height tracks (video: 120px, audio: 80px)
- Left sidebar with "Add Track" buttons
- TracksLayer and ClipsLayer updated for multiple tracks

### Phase 3: Waveforms ✅
- Waveform generator utility (`lib/editor/audio/waveform-generator.ts`)
- WaveformRenderer component renders on audio clips
- Supports trim, zoom, and resampling

### Phase 4: Audio Operations ✅
- Right-click context menu for clips
- Visual link indicators (blue chain badge)
- Menu actions: split, detach audio, unlink, duplicate, delete

---

## Remaining Phases

### Phase 5: Video Layer Compositing

**Goal:** Render multiple video layers with proper z-index ordering and blend modes

**Files to Modify:**
- `lib/editor/player/frame-renderer.ts`

**Tasks:**
1. Update `findActiveClips()` to sort by track `zIndex` (ascending, bottom to top)
2. Create off-screen canvas for each video layer
3. Composite layers using:
   ```typescript
   ctx.globalAlpha = clip.opacity
   ctx.globalCompositeOperation = blendModeToCanvas(clip.blendMode)
   ctx.drawImage(layerCanvas, 0, 0)
   ```
4. Implement `blendModeToCanvas()` helper:
   - `"normal"` → `"source-over"`
   - `"multiply"` → `"multiply"`
   - `"screen"` → `"screen"`
   - etc.

**Testing:**
- Add 2+ video tracks, verify correct stacking order
- Test opacity slider (0-100%)
- Test blend modes

---

### Phase 6: Audio Mixing Integration

**Goal:** Connect AudioMixer to playback and export

**Files to Modify:**
- `lib/editor/player/playback-controller.ts`
- `lib/editor/playback/preview-renderer.ts`
- `lib/editor/export/export-pipeline.ts`

**Tasks:**
1. **Playback Integration:**
   - Replace embedded audio logic with AudioMixer instance
   - Call `audioMixer.play(currentTime)` on play
   - Call `audioMixer.pause()` on pause
   - Update track controls to call `audioMixer.updateTrackVolume()`, etc.

2. **Export Integration:**
   - Use AudioMixer to mix all audio tracks during export
   - Pass mixed audio buffer to encoder
   - Ensure frame-accurate A/V sync

**Testing:**
- Play project with multiple audio tracks, verify mixing works
- Test mute/solo/volume controls affect playback
- Export video, verify all audio tracks are mixed correctly

---

## Testing Checklist

### Basic Multitrack
- [ ] Can add video tracks (button works, track appears)
- [ ] Can add audio tracks (button works, track appears)
- [ ] Track headers show correct names ("Video 1", "Audio 2", etc.)
- [ ] Track controls (mute/solo/lock/visible) render correctly

### Track Controls
- [ ] Mute button toggles state
- [ ] Solo button toggles state
- [ ] Lock button toggles state
- [ ] Visible button toggles state
- [ ] Volume slider works (audio tracks only)

### Waveforms
- [ ] Audio clips show waveform visualization
- [ ] Waveforms render green color
- [ ] Waveforms scale correctly with clip width/zoom
- [ ] Trimmed clips show correct waveform segment

### Context Menu
- [ ] Right-click clip shows context menu
- [ ] "Split Clip" option appears
- [ ] "Detach Audio" appears for video clips only
- [ ] "Unlink" appears for linked clips only
- [ ] Menu closes on outside click or Escape
- [ ] Keyboard shortcut Cmd+B splits clip at playhead

### Visual Indicators
- [ ] Linked clips show blue chain badge (top-right)
- [ ] Badge only shows when clip width > 40px

### Data Persistence
- [ ] Track data includes all new fields (name, solo, zIndex, height, visible)
- [ ] Clip data includes blendMode field
- [ ] No TypeScript errors in console

### Known Limitations (Until Phase 5-6)
- Track controls (mute/solo/volume) don't affect playback yet
- Only one video layer renders (no compositing yet)
- Audio tracks don't play yet (AudioMixer not connected)
- Detach audio action logs to console (not fully implemented)

---

## Quick Reference

### Adding Features to Existing Editor

The editor3 page uses Convex data, not the project store. To add multitrack features:

1. **Add callbacks to Timeline component:**
   ```typescript
   onTrackAdd={(kind) => { /* update Convex */ }}
   onTrackUpdate={(id, updates) => { /* update Convex */ }}
   ```

2. **Update sequence creation** to include new track fields:
   ```typescript
   tracks: [{
     id, name, kind, allowOverlap, clips,
     locked, muted, solo, volume, zIndex, height, visible
   }]
   ```

3. **Update clip creation** to include `blendMode: "normal"`

### Architecture Overview
- **Timeline** = UI editor (manipulates data, fires callbacks)
- **VideoPlayer** = Rendering engine (renders frames from sequence data)
- **AudioMixer** = Audio engine (mixes tracks, applies controls)
- All components are **read-only** on sequence data, only modify via callbacks
