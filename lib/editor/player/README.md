# Video Player Module

Clean, modern canvas-based video player for rendering composite video sequences with effects and transitions.

## Architecture

```
VideoPlayer (React Component)
  ├─ PlaybackController (playback loop & state)
  │   └─ FrameRenderer (canvas rendering)
  │       ├─ VideoLoader (frame decoding)
  │       └─ TransitionRenderer (transition effects)
  └─ Canvas (output)
```

## Features

- ✅ Canvas-based frame rendering
- ✅ Single-clip playback
- ✅ Transition blending (fade, wipe, slide, zoom)
- ✅ Effect application (brightness, contrast, saturation, blur)
- ✅ RequestAnimationFrame playback loop
- ✅ Seek/scrub support
- ✅ Frame caching for performance
- ✅ Clean separation from timeline UI

## Usage

### Basic Example

```typescript
import { VideoPlayer } from "@/components/editor/VideoPlayer";
import { useEditorStore } from "@/stores/editor";

const EditorApp = () => {
  const store = useEditorStore();
  const sequence = store.project.sequences[0];

  return (
    <VideoPlayer
      sequence={sequence}
      mediaAssets={store.project.mediaAssets}
      currentTime={store.currentTime}
      isPlaying={store.isPlaying}
      masterVolume={store.masterVolume}
      onTimeUpdate={(time) => store.setCurrentTime(time)}
      onEnded={() => store.pause()}
      onError={(error) => console.error("Player error:", error)}
    />
  );
};
```

### With Timeline Integration

```typescript
<div className="editor-layout">
  {/* Video Player - Renders frames */}
  <VideoPlayer
    sequence={sequence}
    mediaAssets={mediaAssets}
    currentTime={currentTime}
    isPlaying={isPlaying}
    onTimeUpdate={handleTimeUpdate}
  />

  {/* Timeline - Editing UI */}
  <KonvaTimeline
    sequence={sequence}
    currentTime={currentTime}
    isPlaying={isPlaying}
    onSeek={handleSeek}
    onClipMove={handleClipMove}
    onClipTrim={handleClipTrim}
  />
</div>
```

## Props

### VideoPlayer Component

| Prop | Type | Description |
|------|------|-------------|
| `sequence` | `Sequence` | Sequence to render (clips, tracks, etc.) |
| `mediaAssets` | `Record<string, MediaAssetMeta>` | Media assets referenced by clips |
| `currentTime` | `number` | Current playback time in seconds |
| `isPlaying` | `boolean` | Whether video is currently playing |
| `masterVolume` | `number` | Master volume (0-1), defaults to 1.0 |
| `className` | `string` | Optional CSS class for container |
| `onTimeUpdate` | `(time: number) => void` | Callback fired during playback |
| `onEnded` | `() => void` | Callback fired when playback ends |
| `onError` | `(error: Error) => void` | Callback fired on errors |

## How It Works

### Frame Rendering

When `currentTime` changes (from scrubbing or playback):

1. **Find Active Clips:** Determine which clips are visible at `currentTime`
2. **Check for Transitions:** See if we're in a transition between clips
3. **Load Frames:** Use VideoLoader + mediabunny to decode video frames
4. **Apply Effects:** Apply brightness, contrast, filters to frames
5. **Render to Canvas:** Either draw single frame OR blend two frames with transition
6. **Output:** Canvas displays the composite result

### Transition Detection

Transitions are stored on clips:

```typescript
interface Clip {
  id: string;
  start: number;        // Timeline position
  duration: number;
  transitions: TransitionSpec[];  // Transition at start of clip
  // ...
}

interface TransitionSpec {
  id: string;
  type: "fade" | "wipe-left" | "slide-right" | "zoom-in" | ...;
  duration: number;     // Transition duration in seconds
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
}
```

When rendering:
- If `currentTime` falls within `clip.start` to `clip.start + transition.duration`
- Load frames from both previous and current clip
- Blend them using the appropriate transition type
- Apply easing function to progress value

### Supported Transitions

**Fade:**
- `fade` - Simple crossfade
- `dissolve` - Crossfade with blur

**Wipe:**
- `wipe-left`, `wipe-right`, `wipe-up`, `wipe-down`

**Slide:**
- `slide-left`, `slide-right`, `slide-up`, `slide-down`

**Zoom:**
- `zoom-in`, `zoom-out`

### Supported Effects

**Per-Clip Effects:**
- `brightness` - Adjust brightness (0-2)
- `contrast` - Adjust contrast (0-2)
- `saturation` - Adjust color saturation (0-2)
- `blur` - Gaussian blur (pixels)

Applied via Canvas filters:
```typescript
ctx.filter = "brightness(1.2) contrast(1.1) saturate(1.3)";
```

## Performance

### Frame Caching

- VideoLoader caches decoded frames (default: 48 frames)
- Lookahead decoding (0.5s ahead of current time)
- Cache trimming to prevent memory bloat
- Frames outside ±lookahead window are discarded

### Optimization Tips

1. **Scrubbing:** Debounce rapid scrub updates to avoid excessive re-renders
2. **Resolution:** Lower canvas resolution for preview (scale up with CSS)
3. **Cache Size:** Increase cache for smoother playback, decrease for memory savings
4. **WebGL:** Future enhancement - use WebGL for better performance

## Extending

### Adding New Effects

Add effect type to `/lib/editor/types.ts`:

```typescript
export type EffectType = "brightness" | "contrast" | "myNewEffect";
```

Update `applyEffects()` in `frame-renderer.ts`:

```typescript
case "myNewEffect": {
  const value = effect.params.intensity ?? 0.5;
  filters.push(`myFilter(${value})`);
  break;
}
```

### Adding New Transitions

Add transition type to `/lib/editor/transitions/presets.ts`:

```typescript
export type TransitionType = "fade" | "myTransition";
```

Implement renderer in `/lib/editor/transitions/renderer.ts`:

```typescript
function renderMyTransition(ctx, width, height, fromFrame, toFrame, progress) {
  // Custom transition logic
}
```

## Troubleshooting

### No video displays

- Check that `mediaAssets` contains URLs for all clip `mediaId` values
- Verify VideoDecoder is available (WebCodecs API required)
- Check browser console for errors

### Transitions not working

- Ensure transition is added to clip: `clip.transitions = [transitionSpec]`
- Verify transition duration is reasonable (0.5-1.5s typically)
- Check that clips are adjacent on the timeline

### Poor scrubbing performance

- Reduce canvas resolution (e.g., 960x540 instead of 1920x1080)
- Increase VideoLoader cache size
- Debounce scrub updates in parent component

### Memory leaks

- Ensure VideoPlayer component is properly unmounted
- Check that VideoFrames are being closed after use
- Monitor frame cache size in console logs

## API Reference

### FrameRenderer

```typescript
class FrameRenderer {
  constructor(config: FrameRendererConfig)
  attach(canvas: HTMLCanvasElement): Promise<void>
  detach(): void
  setMediaAssets(assets: Record<string, MediaAssetMeta>): void
  renderFrame(sequence: Sequence, time: number): Promise<void>
}
```

### PlaybackController

```typescript
class PlaybackController {
  constructor(
    frameRenderer: FrameRenderer,
    sequence: Sequence,
    mediaAssets: Record<string, MediaAssetMeta>,
    callbacks?: PlaybackCallbacks
  )
  play(): Promise<void>
  pause(): void
  seek(time: number): Promise<void>
  updateSequence(sequence: Sequence, mediaAssets?: Record<string, MediaAssetMeta>): void
  setMasterVolume(volume: number): void
  destroy(): void
}
```

## Comparison with Other Implementations

| Feature | New VideoPlayer | PreviewRenderer | Twick Player | Clipforge Player |
|---------|----------------|-----------------|--------------|------------------|
| **Architecture** | Clean, modular | Legacy, complex | Third-party | Simple HTML5 |
| **Transitions** | ✅ Full support | ✅ Partial | ✅ Built-in | ❌ None |
| **Effects** | ✅ Canvas filters | ✅ Manual | ✅ Advanced | ❌ None |
| **Code Size** | ~500 lines | ~800 lines | Library (large) | ~200 lines |
| **Maintenance** | Easy | Difficult | Vendor-dependent | Easy |
| **Best For** | Professional editing | Legacy compat | Full editor | Simple playback |

## Future Enhancements

### Planned (Phase 2)

- [ ] AudioMixer for multi-track audio synchronization
- [ ] WebGL rendering for better performance
- [ ] Speed curve support (variable playback speed)
- [ ] Color grading (LUT support)
- [ ] Advanced transitions (custom shaders)

### Possible (Phase 3)

- [ ] WebGPU renderer for modern browsers
- [ ] OffscreenCanvas for background rendering
- [ ] Worker-based frame decoding
- [ ] Real-time export preview
- [ ] Timeline thumbnail generation

## Credits

Built using:
- **mediabunny** - Video decoding (WebCodecs wrapper)
- **React** - Component framework
- **Canvas API** - Frame rendering
- **WebCodecs API** - Video frame extraction

---

**Last Updated:** 2025-11-22
**Version:** 1.0
**Status:** Production Ready (Audio support pending)
