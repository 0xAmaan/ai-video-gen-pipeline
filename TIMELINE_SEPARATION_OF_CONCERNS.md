# Timeline & Video Player Separation of Concerns

> **Document Purpose:** Define clear boundaries between timeline (editing UI) and video player (rendering engine) components.

---

## Core Principle

**Timeline = State Editor | Video Player = Rendering Engine**

The timeline handles all editing logic and UI. The video player is a pure rendering engine that displays what the timeline tells it to show.

---

## Timeline Responsibilities ✅

### What the Timeline DOES:
1. **Display clips visually** - Show clips as rectangles/blocks on tracks
2. **Handle user interactions:**
   - Drag and drop clips
   - Trim clip boundaries with handles
   - Multi-select clips (Shift/Cmd+click, marquee)
   - Rearrange clip order (z-index, track switching)
3. **Editing operations:**
   - Add/remove clips
   - Split clips
   - Adjust clip properties (trim, duration)
   - Add/remove effects and transitions
4. **Snapping & alignment:**
   - Magnetic snapping to other clips
   - Beat marker snapping
   - Grid snapping
5. **Playback control UI:**
   - Playhead/scrubber UI
   - Play/pause button
   - Timeline scrubbing
6. **Visual feedback:**
   - Show waveforms
   - Show thumbnails
   - Effect/transition indicators
   - Selection states

### Timeline API (What it exports):

```typescript
interface TimelineProps {
  // READ-ONLY DATA (displays this)
  sequence: Sequence
  currentTime: number
  isPlaying: boolean
  selectedClipIds: string[]

  // USER ACTION CALLBACKS (fires these when user edits)
  onSeek: (time: number) => void
  onClipMove: (clipId: string, newStart: number) => void
  onClipTrim: (clipId: string, newTrimStart: number, newTrimEnd: number) => void
  onClipSelect: (clipId: string) => void
  onClipDelete: (clipId: string) => void
  // ... other editing callbacks
}
```

### What the Timeline DOES NOT DO:
- ❌ Does NOT render video frames
- ❌ Does NOT decode video files
- ❌ Does NOT apply effects/transitions to actual video
- ❌ Does NOT handle audio playback/mixing
- ❌ Does NOT manage video element state

---

## Video Player Responsibilities ✅

### What the Video Player DOES:
1. **Render composite frames:**
   - Determine which clip(s) are active at currentTime
   - Load video frames from source files
   - Apply effects (opacity, brightness, filters, speed curves)
   - Blend transitions between clips
   - Draw final composite to canvas
2. **Audio synchronization:**
   - Load audio from clips
   - Mix multi-track audio
   - Sync with video playback
   - Handle volume controls
3. **Playback management:**
   - RequestAnimationFrame loop during playback
   - Call onTimeUpdate callback with current time
   - Handle seeks (jump to specific time)
   - Start/stop playback
4. **Performance optimization:**
   - Frame caching
   - Efficient video decoding
   - Memory management

### Video Player API (What it exports):

```typescript
interface VideoPlayerProps {
  // WHAT TO RENDER (reads this)
  sequence: Sequence
  currentTime: number
  isPlaying: boolean
  masterVolume?: number

  // PLAYBACK UPDATES (calls this during playback)
  onTimeUpdate: (time: number) => void
}
```

### What the Video Player DOES NOT DO:
- ❌ Does NOT have editing UI (no drag handles, selection boxes)
- ❌ Does NOT modify sequence data
- ❌ Does NOT handle clip manipulation
- ❌ Does NOT make editing decisions
- ❌ Does NOT store timeline state

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ZUSTAND STORE                             │
│              (Single Source of Truth)                        │
│                                                              │
│  State:                                                      │
│  - project: Project (contains sequences, clips, effects)    │
│  - currentTime: number                                       │
│  - isPlaying: boolean                                        │
│  - selection: { clipIds: string[] }                          │
│                                                              │
│  Actions:                                                    │
│  - setCurrentTime(time)                                      │
│  - play() / pause()                                          │
│  - updateClip(clipId, changes)                               │
│  - deleteClip(clipId)                                        │
│  - addEffect(clipId, effect)                                 │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
             │ Read                         │ Read
             ▼                              ▼
  ┌──────────────────────┐      ┌──────────────────────┐
  │  TIMELINE (UI)       │      │  VIDEO PLAYER        │
  │                      │      │  (Renderer)          │
  │  Props:              │      │                      │
  │  - sequence          │      │  Props:              │
  │  - currentTime       │      │  - sequence          │
  │  - isPlaying         │      │  - currentTime       │
  │  - selectedClipIds   │      │  - isPlaying         │
  │                      │      │  - masterVolume      │
  │  Renders:            │      │                      │
  │  - Clip blocks       │      │  Renders:            │
  │  - Drag handles      │      │  - Canvas frames     │
  │  - Waveforms         │      │  - Audio output      │
  │  - Scrubber UI       │      │                      │
  └──────────┬───────────┘      └──────────┬───────────┘
             │                             │
             │ Callbacks                   │ Callbacks
             │ (user actions)              │ (playback events)
             ▼                             ▼
  onSeek(time) ────────────────────> setCurrentTime(time)
  onClipMove(...) ─────────────────> updateClip(...)
  onClipTrim(...) ─────────────────> updateClip(...)
                                          │
                         onTimeUpdate(time) ─────> setCurrentTime(time)
```

---

## Communication Protocol

### Timeline → Store (User Editing)

When user drags a clip:
```typescript
// Timeline component
const handleClipDrag = (clipId: string, newStart: number) => {
  props.onClipMove(clipId, newStart)  // Fire callback
}

// Parent or store
onClipMove={(clipId, newStart) => {
  store.updateClip(clipId, { start: newStart })  // Update store
}}
```

### Timeline → Store (Seeking)

When user scrubs playhead:
```typescript
// Timeline component
const handleScrub = (time: number) => {
  props.onSeek(time)  // Fire callback
}

// Parent or store
onSeek={(time) => {
  store.setCurrentTime(time)  // Update store
}}
```

### Store → Player (Render Frame)

When store updates:
```typescript
// Player component
useEffect(() => {
  // Automatically re-render when props change
  renderFrameAtTime(props.currentTime)
}, [props.currentTime, props.sequence])
```

### Player → Store (Playback Updates)

During playback:
```typescript
// Player internal (RAF loop)
const tick = () => {
  const newTime = audioContext.currentTime
  props.onTimeUpdate(newTime)  // Call parent
  requestAnimationFrame(tick)
}

// Parent or store
onTimeUpdate={(time) => {
  store.setCurrentTime(time)  // Update store → triggers timeline scrubber update
}}
```

---

## Shared Data Model

Both timeline and player read from the same `Sequence` structure:

```typescript
// lib/editor/types.ts

interface Sequence {
  id: string
  width: number          // Canvas resolution
  height: number
  fps: number
  duration: number       // Total duration (calculated)
  tracks: Track[]        // Video, audio, overlay tracks
}

interface Track {
  id: string
  kind: "video" | "audio" | "overlay" | "fx"
  clips: Clip[]
  locked: boolean
  muted: boolean
  volume: number
}

interface Clip {
  id: string
  mediaId: string        // References MediaAssetMeta
  trackId: string
  kind: "video" | "audio" | "image"

  // Timeline position
  start: number          // When clip starts on timeline (seconds)
  duration: number       // How long clip appears (seconds)

  // Trim (which part of source media to use)
  trimStart: number      // Start offset in source media
  trimEnd: number        // End offset in source media

  // Effects
  opacity: number
  volume: number
  effects: Effect[]
  transitions: TransitionSpec[]
  speedCurve: SpeedCurve | null
  preservePitch: boolean
}
```

**Timeline uses this to:**
- Display clip blocks at correct positions
- Show clip durations
- Enable trimming UI

**Player uses this to:**
- Determine active clips at currentTime
- Load correct media sources
- Apply effects and transitions
- Render composite frame

---

## Example: User Scrubs Timeline with Transition

### Scenario:
```
Timeline:
Track 1: [Clip A: 0-10s] ──[1s crossfade]── [Clip B: 10-20s]

User scrubs to 9.5s (middle of transition)
```

### What Happens:

1. **Timeline Component:**
   ```typescript
   // User drags scrubber to 9.5s
   onSeek(9.5)  // Fire callback
   ```

2. **Store Updates:**
   ```typescript
   store.setCurrentTime(9.5)
   // State now: { currentTime: 9.5, isPlaying: false }
   ```

3. **Timeline Re-renders:**
   ```typescript
   // Receives new currentTime prop
   <Playhead position={9.5} />  // Moves playhead to 9.5s mark
   ```

4. **Video Player Re-renders:**
   ```typescript
   // Receives new currentTime prop
   useEffect(() => {
     renderFrameAtTime(9.5)
   }, [currentTime])

   // Player logic:
   // 1. Detect Clip A and Clip B both active (transition overlap)
   // 2. Load frame from Clip A at 9.5s
   // 3. Load frame from Clip B at -0.5s (pre-roll)
   // 4. Calculate blend: 50% through 1s transition = 0.5 alpha
   // 5. Draw Clip A with alpha 0.5
   // 6. Draw Clip B with alpha 0.5
   // 7. Result: Smooth crossfade visible on canvas
   ```

**Timeline's role:** Provide scrubber UI, fire onSeek callback
**Player's role:** Render composite frame with transition blended

---

## Key Takeaways for Timeline Implementation

1. **Timeline is UI-only** - It displays clips and handles interactions, but doesn't render video
2. **Timeline owns editing logic** - All clip manipulation happens via timeline callbacks
3. **Timeline reads state** - It receives sequence, currentTime, selection as props
4. **Timeline fires callbacks** - It calls onSeek, onClipMove, etc. when user edits
5. **Timeline is stateless** - All state lives in Zustand store, not timeline component
6. **Timeline doesn't know about video rendering** - No canvas, no video elements, no frame decoding

---

## Questions for Timeline Agent

If you're building the timeline, ask yourself:

- ✅ Am I just displaying this data? → Timeline's job
- ✅ Am I handling user drag/click? → Timeline's job
- ✅ Am I calling a callback to update state? → Timeline's job
- ❌ Am I rendering video frames? → Player's job
- ❌ Am I decoding video files? → Player's job
- ❌ Am I applying effects to actual video? → Player's job

---

## Integration Example

```typescript
// Parent component (StandaloneEditorApp.tsx)
const EditorApp = () => {
  const store = useEditorStore()

  return (
    <div className="editor-layout">
      {/* VIDEO PLAYER - Renders video */}
      <VideoPlayer
        sequence={store.project.sequences[0]}
        currentTime={store.currentTime}
        isPlaying={store.isPlaying}
        masterVolume={store.masterVolume}
        onTimeUpdate={(time) => store.setCurrentTime(time)}
      />

      {/* TIMELINE - Editing UI */}
      <Timeline
        sequence={store.project.sequences[0]}
        currentTime={store.currentTime}
        isPlaying={store.isPlaying}
        selectedClipIds={store.selection.clipIds}
        onSeek={(time) => store.setCurrentTime(time)}
        onClipMove={(clipId, newStart) => store.updateClip(clipId, { start: newStart })}
        onClipTrim={(clipId, trimStart, trimEnd) => store.updateClip(clipId, { trimStart, trimEnd })}
        onClipSelect={(clipId) => store.setSelection({ clipIds: [clipId] })}
      />
    </div>
  )
}
```

Both components share the same data source (store) but have completely different responsibilities.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-22
**Maintained By:** Video Player Implementation Team
