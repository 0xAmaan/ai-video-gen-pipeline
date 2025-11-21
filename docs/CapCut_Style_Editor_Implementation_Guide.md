# CapCut-Style Web Editor – Implementation Guide (C++/MediaBunny Alignment)

## 1. Goals, Scope & UI Alignment
- Deliver a CapCut-class timeline editor inside `ai-video-gen-pipeline` that uses **MediaBunny for ingest/export** and **C++/WebAssembly (Emscripten) for the timeline engine, effects, and compositing** exactly as described in `CapCut_Cpp_MediaBunny_Implementation_Guide.md`.
- Treat `ai-video-gen-pipeline/v0_CapCut_UI` as the canonical frontend. Keep and wire up the essential surfaces that already exist (`TopBar`, `Sidebar` + `MediaPanel`, `PreviewPanel`, `Timeline`, `ExportModal`). Non-essential controls (Cloud/Dropbox buttons, placeholder grid overlays, RecordingPanel) may stay visually but must be feature-flagged or hidden until they are backed by logic.
- Make the document executable for an agentic GPT-5.1-codex: every requirement below spells out the data flow, APIs, and file touchpoints needed to connect the React UI to the C++/WASM + MediaBunny backend.

## 2. Architecture Snapshot
Layered stack (mirrors §2–§7 of `CapCut_Cpp_MediaBunny_Implementation_Guide.md`):

1. **UI (Next.js / React in `v0_CapCut_UI`)** – Visual components, pointer interactions, keyboard shortcuts.
2. **TypeScript Orchestration Layer** – `ProjectStore`, `MediaBunnyManager`, `WorkerManager`, `PreviewRenderer`, `ExportPipeline`. Lives under `ai-video-gen-pipeline/lib/editor`.
3. **Web Workers** – `demux-worker.ts`, `effects-worker.ts`, `encode-worker.ts` (copied/adapted from §4 project structure of the MediaBunny guide). Workers isolate heavy MediaBunny and WebCodecs operations.
4. **C++/WASM Engine** – Timeline, clip math, effects, compositor compiled via Emscripten (`ai-video-gen-pipeline/engine/cpp`). Builds produce `timeline-engine.wasm` and JS glue consumed by workers + main thread.
5. **MediaBunny + WebCodecs** – Demux/mux, metadata, packet streaming, encode/decode (per §6, §10 from the guide).
6. **Storage/Persistence** – IndexedDB (project JSON + undo stack), user-selected filesystem handles for exports, optional cloud sync.

IPC contract: UI dispatches actions -> ProjectStore -> (a) updates WASM timeline through bindings, (b) posts messages to workers (MediaBunny, preview, export), (c) notifies UI via subscribed selectors. Workers respond with `Transferable` frames/buffers to avoid copies.

## 3. Project Layout & Responsibilities
```
ai-video-gen-pipeline/
├── v0_CapCut_UI/                     # React/Next UI shell (keep markup, inject hooks)
├── engine/
│   ├── cpp/                          # Timeline, compositor, effects (C++)
│   └── build.sh                      # Mirrors build flags from CapCut_Cpp guide §7.3
├── lib/editor/                       # TS orchestrators shared by UI
│   ├── core/                         # ProjectStore, selection logic, undo/redo
│   ├── io/                           # MediaBunnyManager, AssetCache
│   ├── playback/                     # PreviewRenderer, FrameCache
│   ├── export/                       # ExportPipeline, mux jobs
│   └── workers/                      # Worker entry points (TS -> web workers)
└── docs/PRDs/                        # Requirements (this file + PRDs)
```
- `v0_CapCut_UI/app/page.tsx` already composes `TopBar`, `MediaPanel`, `PreviewPanel`, `Timeline`, `ExportModal`, `RecordingPanel`. Replace local `useState` with selectors from `ProjectStore`.
- The C++ files (`timeline.cpp/h`, `effects_processor.cpp/h`, `compositor.cpp/h`, `js_bindings.cpp`) come straight from `CapCut_Cpp_MediaBunny_Implementation_Guide.md` §§5–9. Mirror the same folder split to make the guide executable.

## 4. Core Data Contracts & Persistence
Bridge TS ↔ WASM with the following schema (TypeScript view shown; matching structs already exist in §5.1 of the MediaBunny guide and in §7.1 timeline.cpp/h):

```ts
type TrackKind = 'video' | 'audio' | 'overlay' | 'fx';

interface Effect {
  id: string;
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'custom';
  params: Record<string, number>;
  enabled: boolean;
}

interface Clip {
  id: string;
  mediaId: string;
  trackId: string;
  kind: 'video' | 'audio' | 'image';
  start: number;          // seconds on sequence timeline
  duration: number;
  trimStart: number;      // seconds into source
  trimEnd: number;        // seconds from source end
  opacity: number;
  volume: number;
  effects: Effect[];
  transitions: TransitionSpec[];
}

interface Track {
  id: string;
  kind: TrackKind;
  allowOverlap: boolean;
  clips: Clip[];
  locked: boolean;
  muted: boolean;
}

interface Sequence {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  duration: number;
  tracks: Track[];
}

interface Project {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  sequences: Sequence[];
  mediaAssets: Record<string, MediaAssetMeta>;
  settings: { snap: boolean; grid: boolean; };
}
```

- Store canonical `Project` JSON + undo/redo stack in IndexedDB (`projectStore.save()` after every reducer commit). Keep snapshots small via structural sharing (Immer or manual patches) and only persist diff metadata for the history queue.
- WASM `Timeline` keeps only the active sequence’s numeric state for fast hit-testing. Use deterministic IDs so TypeScript and C++ reference the same clips.

## 5. Media Ingest Flow (MediaBunny)
`CapCut_Cpp_MediaBunny_Implementation_Guide.md` §5.2–§6 already define `MediaBunnyManager`. Embed it under `lib/editor/io/MediaBunnyManager.ts` and wire it to `v0_CapCut_UI/components/editor/media-panel.tsx`.

Flow:
1. **Drop/upload (MediaPanel)** – Replace `handleFileUpload` in `v0_CapCut_UI/app/page.tsx` with a hook: `const importAssets = useMediaImport();`. The hook posts files to `demux-worker.ts`.
2. **Demux Worker** – Instantiates `MediaBunnyManager`, calls `importFile(file)` (per §6.2) and returns metadata, track info, and a `mediaId`.
3. **Store Update** – `ProjectStore` writes metadata into `project.mediaAssets` and associates default poster frames (generated via `MediaBunnyManager.generateThumbnail()`).
4. **UI Refresh** – `MediaPanel` reads from store selectors; `Timeline` receives `clips` referencing `mediaId`.
5. **Caching** – Use `FrameCache` (see §5.2 + §7 preview renderer snippet) for thumbnails + preview frames. Evict least-recently-used frames; keep at most 150 frames (configurable).
6. **Fallback** – When MediaBunny cannot parse a format (Safari / Firefox), fall back to browser file readers and disable advanced preview but still allow import metadata (log warnings).

## 6. Timeline Engine (C++/WebAssembly)
Implementation guidance anchored to §7 of the MediaBunny guide:

- **Compilation** – Place C++ sources under `engine/cpp`. Use the provided `build.sh` (O3, `-msimd128`, pthreads, `MODULARIZE=1`, `EXPORT_ES6=1`). Output lives in `v0_CapCut_UI/public/wasm/timeline-engine.{js,wasm}`.
- **Bindings** – `Timeline` class exposes `addClip`, `removeClip`, `moveClip`, `getClipsAtTime`, `setCurrentTime`. Extend the header with editing ops you need (trim, split, ripple). Bindings via `EMSCRIPTEN_BINDINGS` (see §7.1 sample).
- **Interop** – In TypeScript, load the WASM module once using dynamic `import('/wasm/timeline-engine.js')`. Wrap with `TimelineService` that queues calls until instantiation resolves. Provide synchronous read APIs by caching mirrors of clip data in JS and using WASM for collision checks + interval queries.
- **Threading** – Enable SharedArrayBuffer (same cross-origin isolation requirements as §7.3). `WorkerManager` spawns an effects worker and passes `Module.HEAPU8.buffer` to workers needing direct access.

## 7. Real-time Preview & Playback
Implement `PreviewRenderer` exactly like §9 preview snippet and connect it to `v0_CapCut_UI/components/editor/preview-panel.tsx`.

Pipeline:
1. `Timeline` component (React) broadcasts `onPlay`, `onPause`, `onScrub`, `onZoom` via context (replace prop drilling with hooks).
2. `PreviewRenderer` listens to `ProjectStore.currentTime`, fetches visible clips via WASM `getClipsAtTime`, requests `VideoFrame`s from MediaBunny video sinks, applies effects via WASM (brightness/contrast/saturation/blur) and composites layers using WebGL (WebGLRenderer from §4 project structure).
3. Rendered frame is drawn into `<canvas>` mounted inside `PreviewPanel`. Replace placeholder `<img>` with `<canvas ref={previewCanvasRef}>`.
4. Audio – Use AudioWorklets fed by MediaBunny audio sinks; keep them in sync via shared `currentTime`.
5. `TopBar` play controls call store actions that start/stop the `requestAnimationFrame` loop described in §9 preview snippet; maintain gap-skipping logic from ClipForge timeline notes to avoid busy loops during silent ranges.

## 8. Editing Operations & UI Mapping
All editing commands are pure functions in TS, validated in WASM, and mirrored visually in React.

| Operation | UI origin | TS action | WASM method | Notes |
|-----------|-----------|-----------|-------------|-------|
| Add Clip | `MediaPanel` drag/drop to `Timeline` | `addClip({mediaId, trackId, start})` | `Timeline::addClip` | Validate overlap via WASM before committing; fallback to next free track if `allowOverlap=false`. |
| Move Clip | Dragging `Timeline` rows | `moveClip(clipId, delta, targetTrack?)` | `Timeline::moveClip` | Use snapping (50 ms epsilon) referencing ClipForge timeline notes. |
| Trim Left/Right | Resize handles on clip component | `trimClip({clipId, edge, delta})` | `Timeline::trimClipLeft/Right` | Update `trimStart`/`trimEnd`, enforce `duration >= 3 frames`. |
| Split | Keyboard `Cmd/Ctrl+B` or context menu | `splitClip({clipId, time})` | `Timeline::splitClip` | Duplicate clip metadata, re-use MediaBunny sink handles, refresh thumbnails. |
| Ripple Delete | Delete button in Timeline toolbar | `rippleDelete(clipId)` | `Timeline::rippleDelete` | Reflow subsequent clips unless track is locked. |
| Transitions/Effects | `Timeline` head/tail handles & `EffectsPanel` (Sidebar tab) | `updateEffects(clipId, effectPatch)` | `EffectsProcessor::applyEffects` | Hook to `effects-worker` with shared memory for pixels. |
| Zoom & Scroll | `TopBar` zoom slider + pinch gestures | `setZoom(level)` | (JS only) | Keep virtualization window stable (center on playhead). |

UI control notes:
- `Timeline` component currently renders two static tracks. Replace track arrays with store-driven data and virtualize rows (similar to `twick` timeline). Keep the existing zoom slider but wire it to `ProjectStore.zoom`.
- `Sidebar`’s extra tabs (AI scripts, templates, etc.) remain UI-only until there is backend support; guard with feature flags so GPT agent knows not to wire nonexistent APIs.

## 9. Export Pipeline (MediaBunny + WebCodecs)
Follow §10 of the MediaBunny guide:
1. `ExportModal` collects resolution, fps, format, bitrate.
2. `ExportPipeline` posts a job to `encode-worker`. Worker:
   - Iterates timeline frames via WASM `timeline.getFramesForRange`.
   - Requests decoded frames/audio packets through MediaBunny sinks.
   - Applies effects/compositing using `EffectsProcessor` and `Compositor` C++ classes.
   - Encodes via WebCodecs (H.264/AV1) and remuxes using MediaBunny `Muxer`.
3. Progress events flow back to UI every ~250 ms (throttled). Export modal updates progress bar and allows cancel (terminate worker, flush WASM state).
4. On success, worker returns a `FileSystemWritableFileStream` handle (if user granted) or an in-memory `Blob`. Offer “Open in Finder” + “Copy link”.

## 10. UI Integration Checklist (v0_CapCut_UI)
- `TopBar` (`components/editor/top-bar.tsx`) – Replace stub handlers with store dispatchers (`play`, `pause`, `toggleLoop`, `setZoom`). Record button stays but opens RecordingPanel only if capture APIs are ready; otherwise hide.
- `Sidebar` + `MediaPanel` – Hook dropzones to `useMediaImport`. Populate lists from `project.mediaAssets`. Provide context menu for “Add to track X” invoking `addClip`.
- `PreviewPanel` – Replace placeholder image with `<canvas>` + `<audio>` outputs. Bind play controls to store actions. Buttons: `Grid3x3` toggles guide overlay, `ZoomIn` cycles viewport scale, `MessageSquare` opens comments drawer (optional stub).
- `Timeline` – Convert to controlled component: receives `tracks` + `currentTime` from selectors, dispatches editing commands, shows selection rectangles. Implement virtualization (only render ±30 seconds around viewport) and add markers row.
- `ExportModal` – Wire to `useExportJob`. Show queue state, allow background exports (close modal but keep toast).
- `RecordingPanel` – Optional: repurpose as **Voiceover Recorder** (records mic, drops resulting WAV onto active audio track). If not implementing immediately, hide the button or show a tooltip “Coming soon”.

## 11. Performance, Robustness & Observability
- **Virtualization** – Borrow logic from Twick timeline (`twick/packages/video-editor/src/components/timeline/timeline-view.tsx`). Only mount clips inside `[viewportStart, viewportEnd]` ± buffer. All geometry calculations happen in WASM to avoid layout thrash.
- **Frame Cache** – Cap preview caching at ~150 frames (configurable). Use `FrameCache` class from §9 snippet.
- **Thread Affinity** – Keep MediaBunny operations in workers; they can run +470× faster than `ffmpeg.wasm` but still block the main thread if misused.
- **Error Surfacing** – Wrap worker replies in discriminated unions `{ type: 'error'; code; details }`. `PreviewPanel` should show “Media missing” overlay when sinks fail (similar to ClipForge defensive UI).
- **Instrumentation** – Add `PerformanceMonitor` (see §4 project structure). Log decode, effect, composite, encode durations; send aggregated metrics to console + optional telemetry endpoint.

## 12. Implementation Roadmap for the Agent
1. **Bootstrap toolchain** – Install Emscripten + Node dependencies (per CapCut_Cpp guide §3). Verify `emcc --version`. Scaffold `engine/cpp`.
2. **Port C++ sources** – Drop in `timeline`, `effects_processor`, `compositor`, `js_bindings` from the guide. Run `./engine/build.sh` to produce WASM artifacts stored under `v0_CapCut_UI/public/wasm`.
3. **Create TS orchestration layer** – Implement `ProjectStore` (Zustand/Redux), `MediaBunnyManager`, `WorkerManager`, `PreviewRenderer`, `ExportPipeline`. Copy interface designs from guide §§5–10.
4. **Wire v0 UI** – Replace `useState` in `app/page.tsx` with selectors/actions, update components to consume store data, render `<canvas>` preview, add virtualization to timeline.
5. **Hook editing commands** – Implement drag/trim interactions, fire store actions, sync with WASM timeline, and confirm invariants (snapping, ripple rules).
6. **Integrate preview + playback** – Connect `PreviewPanel` canvas to `PreviewRenderer`, confirm audio/video sync, and implement pause/play toggles.
7. **Implement export dialog** – Launch encode worker, report progress, allow cancel/retry, and save to disk via File System Access API.
8. **Persistence + undo/redo** – Add IndexedDB autosave, diff-based history, and keyboard shortcuts.
9. **QA + benchmarking** – Measure ingest throughput (~60–470× faster than ffmpeg.wasm per MediaBunny benchmarks), preview FPS, encode latency. Compare results to CapCut benchmarks cited in §1 of the MediaBunny guide.

Following this blueprint keeps the UI from `v0_CapCut_UI` intact while anchoring all heavy lifting to the proven C++/WASM + MediaBunny architecture. The agent can now execute the build end-to-end without ambiguity.
